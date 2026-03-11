import { useNavigate } from 'react-router-dom';
import Button from './shared/Button';

// Load Space Grotesk font
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap';
if (!document.head.querySelector('[href*="Space+Grotesk"]')) {
    document.head.appendChild(fontLink);
}

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-100 via-primary-200 to-primary-300 flex items-center justify-center px-4">
            <div className="text-center max-w-4xl w-full">
                {/* Title */}
                <h1
                    className="text-6xl md:text-7xl font-bold text-gray-900 mb-4 animate-fade-in"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                    Lyfe : In Sync
                </h1>

                {/* Subtitle */}
                <p className="text-2xl md:text-3xl text-gray-800 mb-16">
                    Visit as ?
                </p>

                {/* Role Selection Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                    {/* Landlord Card */}
                    <button
                        onClick={() => navigate('/login')}
                        className="group bg-gray-100 hover:bg-white rounded-2xl p-12 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                    >
                        <div className="flex flex-col items-center">
                            {/* Icon */}
                            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                🏠
                            </div>

                            {/* Text */}
                            <h2 className="text-3xl font-bold text-gray-900">Landlord</h2>
                            <p className="text-gray-500 text-sm mt-2">Sign in to manage your PGs</p>
                        </div>
                    </button>

                    {/* Tenant Card */}
                    <button
                        onClick={() => navigate('/tenant-login')}
                        className="group bg-gray-100 hover:bg-white rounded-2xl p-12 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                    >
                        <div className="flex flex-col items-center">
                            {/* Icon */}
                            <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                🔑
                            </div>

                            {/* Text */}
                            <h2 className="text-3xl font-bold text-gray-900">Tenant</h2>
                            <p className="text-gray-500 text-sm mt-2">Sign in to view your room</p>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <p className="mt-16 text-gray-700 text-sm">
                    Manage your PG properties with ease
                </p>
            </div>
        </div>
    );
}
