export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            {icon && <div className="text-6xl mb-4">{icon}</div>}
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
            {description && <p className="text-gray-600 mb-6 max-w-md">{description}</p>}
            {action && <div>{action}</div>}
        </div>
    );
}
