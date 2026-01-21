from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta
from functools import wraps
import os
from dotenv import load_dotenv
import base64
import numpy as np
from io import BytesIO
from PIL import Image
import insightface
from insightface.app import FaceAnalysis

load_dotenv()

app = Flask(__name__)

# CORS - Allow credentials
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

MONGO_URI = os.getenv('MONGO_URI')
SECRET_KEY = os.getenv('SECRET_KEY')
JWT_SECRET = os.getenv('JWT_SECRET_KEY')

app.config['SECRET_KEY'] = SECRET_KEY

print("Connecting to MongoDB...")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info()
    db = client.get_database('faceid')
    print("✅ MongoDB connected!")
except Exception as e:
    print(f"❌ MongoDB failed: {e}")
    exit(1)

print("Initializing FaceAnalysis...")
try:
    face_app = FaceAnalysis(
        name='buffalo_l',
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    )
    face_app.prepare(ctx_id=0, det_size=(640, 640))
    providers = face_app.det_model.session.get_providers()
    if 'CUDAExecutionProvider' in providers:
        print("✅ GPU enabled!")
    else:
        print("⚠️  CPU mode")
except Exception as e:
    print(f"❌ FaceAnalysis failed: {e}")
    exit(1)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            print("❌ No token")
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            user_id = data.get('user_id')
            
            if not user_id:
                print("❌ No user_id in token")
                return jsonify({'error': 'Invalid token'}), 401
            
            # Convert to ObjectId
            if isinstance(user_id, str):
                try:
                    user_id = ObjectId(user_id)
                except:
                    pass
            
            current_user = db.users.find_one({'_id': user_id})
            
            if not current_user:
                print(f"❌ User not found: {user_id}")
                return jsonify({'error': 'User not found'}), 401
            
            print(f"✅ Auth: {current_user.get('username')}")
            
        except jwt.ExpiredSignatureError:
            print("❌ Token expired")
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token: {e}")
            return jsonify({'error': 'Invalid token'}), 401
        except Exception as e:
            print(f"❌ Auth error: {e}")
            return jsonify({'error': 'Authentication failed'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def base64_to_image(base64_str):
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        img = Image.open(BytesIO(img_data))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        return np.array(img)
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def cosine_similarity(emb1, emb2):
    return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({'error': 'Missing required fields'}), 400
        
        existing_user = db.users.find_one({'$or': [{'email': email}, {'username': username}]})
        if existing_user:
            return jsonify({'error': 'User already exists'}), 400
        
        hashed_password = generate_password_hash(password)
        user_id = db.users.insert_one({
            'username': username,
            'email': email,
            'password': hashed_password,
            'created_at': datetime.utcnow(),
            'acquaintances': []
        }).inserted_id
        
        token = jwt.encode({
            'user_id': str(user_id),
            'exp': datetime.utcnow() + timedelta(days=30)
        }, JWT_SECRET, algorithm='HS256')
        
        print(f"✅ Registered: {username}")
        
        return jsonify({
            'token': token,
            'username': username,
            'hasAcquaintances': False
        }), 201
    
    except Exception as e:
        print(f"❌ Register error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Missing credentials'}), 400
        
        user = db.users.find_one({'email': email})
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        token = jwt.encode({
            'user_id': str(user['_id']),
            'exp': datetime.utcnow() + timedelta(days=30)
        }, JWT_SECRET, algorithm='HS256')
        
        has_acquaintances = len(user.get('acquaintances', [])) > 0
        
        print(f"✅ Login: {user['username']} (Has people: {has_acquaintances})")
        
        return jsonify({
            'token': token,
            'username': user['username'],
            'hasAcquaintances': has_acquaintances
        }), 200
    
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recognize', methods=['POST'])
@token_required
def recognize(current_user):
    try:
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image provided'}), 400
        
        img = base64_to_image(image_data)
        if img is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        faces = face_app.get(img)
        
        if not faces:
            return jsonify([]), 200
        
        acquaintances = current_user.get('acquaintances', [])
        
        results = []
        for face in faces:
            bbox = face.bbox.astype(int).tolist()
            embedding = face.embedding
            
            best_match = None
            best_similarity = 0.0
            
            for acq in acquaintances:
                acq_embedding = np.array(acq['embedding'])
                similarity = cosine_similarity(embedding, acq_embedding)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = acq
            
            if best_match and best_similarity > 0.4:
                results.append({
                    'name': best_match['name'],
                    'relation': best_match.get('relationship', ''),
                    'confidence': float(best_similarity),
                    'bbox': bbox
                })
            else:
                results.append({
                    'name': 'Unknown',
                    'confidence': 0.0,
                    'bbox': bbox
                })
        
        return jsonify(results), 200
    
    except Exception as e:
        print(f"❌ Recognition error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/acquaintances/add', methods=['POST'])
@token_required
def add_acquaintance(current_user):
    try:
        data = request.json
        name = data.get('name')
        relationship = data.get('relationship', '')
        image_data = data.get('image')
        
        if not name or not image_data:
            return jsonify({'error': 'Name and image are required'}), 400
        
        img = base64_to_image(image_data)
        if img is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        faces = face_app.get(img)
        
        if not faces:
            return jsonify({'error': 'No face detected in image'}), 400
        
        if len(faces) > 1:
            return jsonify({'error': 'Multiple faces detected. Please use an image with only one face.'}), 400
        
        embedding = faces[0].embedding.tolist()
        
        existing = db.users.find_one({
            '_id': current_user['_id'],
            'acquaintances.name': name
        })
        
        if existing:
            return jsonify({'error': 'Person with this name already exists'}), 400
        
        acquaintance = {
            'id': str(datetime.utcnow().timestamp()).replace('.', ''),
            'name': name,
            'relationship': relationship,
            'embedding': embedding,
            'embedding_dim': len(embedding),
            'image': image_data,  # Store the base64 image
            'added_at': datetime.utcnow()
        }
        
        db.users.update_one(
            {'_id': current_user['_id']},
            {'$push': {'acquaintances': acquaintance}}
        )
        
        print(f"✅ Added: {name} for {current_user.get('username')}")
        
        return jsonify({
            'message': 'Acquaintance added successfully',
            'name': name,
            'relationship': relationship
        }), 201
    
    except Exception as e:
        print(f"❌ Add error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/acquaintances', methods=['GET'])
@token_required
def get_acquaintances(current_user):
    try:
        acquaintances = current_user.get('acquaintances', [])
        result = [{
            'id': acq.get('id'),
            'name': acq.get('name'),
            'relationship': acq.get('relationship', ''),
            'image': acq.get('image'),  # Include the image
            'added_at': acq.get('added_at')
        } for acq in acquaintances]
        return jsonify(result), 200
    except Exception as e:
        print(f"❌ Get error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/acquaintances/<acquaintance_id>', methods=['DELETE'])
@token_required
def delete_acquaintance(current_user, acquaintance_id):
    try:
        result = db.users.update_one(
            {'_id': current_user['_id']},
            {'$pull': {'acquaintances': {'id': acquaintance_id}}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Deleted: {acquaintance_id}")
            return jsonify({'message': 'Acquaintance deleted successfully'}), 200
        else:
            return jsonify({'error': 'Acquaintance not found'}), 404
    except Exception as e:
        print(f"❌ Delete error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    gpu_available = 'CUDAExecutionProvider' in face_app.det_model.session.get_providers()
    return jsonify({
        'status': 'healthy',
        'gpu_available': gpu_available,
        'database': 'connected'
    }), 200

if __name__ == '__main__':
    print("\n🚀 FaceID Backend Server")
    print(f"📍 http://localhost:5000")
    print("=" * 40)
    app.run(debug=True, host='0.0.0.0', port=5000)