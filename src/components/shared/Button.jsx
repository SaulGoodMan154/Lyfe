export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    onClick,
    type = 'button',
    className = '',
    disabled = false
}) {
    const baseStyles = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
        primary: 'bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-500',
        secondary: 'bg-secondary-500 hover:bg-secondary-600 text-white focus:ring-secondary-500',
        outline: 'border-2 border-primary-500 text-primary-600 hover:bg-primary-50',
        ghost: 'text-gray-700 hover:bg-gray-100',
        danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {children}
        </button>
    );
}
