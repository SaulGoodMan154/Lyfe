export default function Card({ children, className = '', hover = false }) {
    return (
        <div
            className={`bg-white rounded-xl shadow-md p-6 ${hover ? 'hover:shadow-lg transition-shadow duration-200' : ''} ${className}`}
        >
            {children}
        </div>
    );
}
