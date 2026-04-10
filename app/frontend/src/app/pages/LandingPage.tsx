import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Activity, Shield, TrendingUp, Users, CheckCircle, ArrowRight } from 'lucide-react';

export function LandingPage() {
  const features = [
    {
      icon: Activity,
      title: 'Advanced Risk Assessment',
      description: 'AI-powered algorithms analyze multiple factors to provide accurate prostate cancer risk predictions.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your health data is encrypted and protected with industry-standard security measures.',
    },
    {
      icon: TrendingUp,
      title: 'Track Your Health',
      description: 'Monitor your risk factors over time and receive personalized recommendations.',
    },
    {
      icon: Users,
      title: 'Expert Support',
      description: 'Access educational resources and connect with healthcare professionals.',
    },
  ];

  const benefits = [
    'Early detection through regular risk assessments',
    'Personalized health insights and recommendations',
    'Secure medical history tracking',
    'Evidence-based educational resources',
    'Easy appointment scheduling',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">ProstAPP</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Prostate Cancer Risk Prediction Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Take control of your health with our advanced AI-powered risk assessment tool. 
            Early detection saves lives.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Assessment <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
          Why Choose ProstAPP?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-blue-400 transition-colors">
              <CardHeader>
                <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Benefits of Regular Screening
            </h2>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 flex-shrink-0 mt-1" />
                  <p className="text-lg">{benefit}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Create Your Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">10,000+</div>
            <div className="text-gray-600 text-lg">Users Assessed</div>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">95%</div>
            <div className="text-gray-600 text-lg">Accuracy Rate</div>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">24/7</div>
            <div className="text-gray-600 text-lg">Access to Platform</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-6 w-6 text-blue-400" />
                <span className="text-xl font-bold text-white">ProstAPP</span>
              </div>
              <p className="text-sm">
                Advanced prostate cancer risk prediction for better health outcomes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Platform</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/dashboard/risk-assessment" className="hover:text-white">Risk Assessment</Link></li>
                <li><Link to="/dashboard/education" className="hover:text-white">Education</Link></li>
                <li><Link to="/dashboard/appointments" className="hover:text-white">Appointments</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li>support@prostapp.com</li>
                <li>1-800-PROSTAPP</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2026 ProstAPP. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
