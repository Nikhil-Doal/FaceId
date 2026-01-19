from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from models import users
import re

auth_bp = Blueprint("auth", __name__)

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# REGISTER
@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")

        # Validation
        if not username or not email or not password:
            return jsonify({"error": "All fields are required"}), 400

        if len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters"}), 400

        if not validate_email(email):
            return jsonify({"error": "Invalid email format"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        # Check if user exists
        if users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 400

        if users.find_one({"username": username}):
            return jsonify({"error": "Username already taken"}), 400

        # Create user
        hashed_password = generate_password_hash(password)
        user = {
            "username": username,
            "email": email,
            "password": hashed_password
        }
        result = users.insert_one(user)
        
        # Create token
        token = create_access_token(identity=str(result.inserted_id))
        
        return jsonify({
            "message": "User registered successfully",
            "token": token,
            "username": username
        }), 201

    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

# LOGIN
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        # Validation
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Find user
        user = users.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        # Check password
        if not check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        # Create token
        token = create_access_token(identity=str(user["_id"]))
        
        return jsonify({
            "message": "Login successful",
            "token": token,
            "username": user["username"]
        }), 200

    except Exception as e:
        return jsonify({"error": f"Login failed: {str(e)}"}), 500