export default function MyButton({
  label = "Submit",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      className={`rounded bg-red-900 px-4 py-2 text-white
        hover:bg-red-700 hover:shadow-lg transition-transform
        duration-200 hover:scale-105 ${className}`}
    >
      {label}
    </button>
  );
}