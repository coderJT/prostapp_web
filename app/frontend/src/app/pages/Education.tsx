import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { BookOpen, Video, FileText, Search, ExternalLink } from 'lucide-react';

type EducationSource = {
  id: number;
  category: 'articles' | 'resources' | 'videos';
  source: string;
  title: string;
  description: string;
  url: string;
};

const FALLBACK_ARTICLES: EducationSource[] = [
  {
    id: 1,
    category: 'articles',
    source: 'NCI',
    title: 'NCI: Prostate Cancer',
    description: 'National Cancer Institute overview of risk factors, diagnosis, and treatment options.',
    url: 'https://www.cancer.gov/types/prostate',
  },
  {
    id: 2,
    category: 'articles',
    source: 'CDC',
    title: 'CDC: Prostate Cancer',
    description: 'CDC education and screening conversation guidance for prostate cancer.',
    url: 'https://www.cdc.gov/cancer/prostate/index.htm',
  },
  {
    id: 3,
    category: 'articles',
    source: 'ACS',
    title: 'American Cancer Society: Prostate Cancer',
    description: 'American Cancer Society patient-focused information on prevention and treatment.',
    url: 'https://www.cancer.org/cancer/types/prostate-cancer.html',
  },
];

const FALLBACK_RESOURCES: EducationSource[] = [
  {
    id: 101,
    category: 'resources',
    source: 'Mayo Clinic',
    title: 'Mayo Clinic: Prostate Cancer',
    description: 'Clinical symptom and cause information for patients and families.',
    url: 'https://www.mayoclinic.org/diseases-conditions/prostate-cancer/symptoms-causes/syc-20353087',
  },
  {
    id: 102,
    category: 'resources',
    source: 'PCF',
    title: 'Prostate Cancer Foundation: Patient Resources',
    description: 'Support resources and practical education from the Prostate Cancer Foundation.',
    url: 'https://www.pcf.org/patient-resources/',
  },
  {
    id: 103,
    category: 'resources',
    source: 'Urology Care Foundation',
    title: 'Urology Care Foundation: Prostate Cancer',
    description: 'Patient education written by urology experts.',
    url: 'https://www.urologyhealth.org/urology-a-z/p/prostate-cancer',
  },
];

const FALLBACK_VIDEOS: EducationSource[] = [
  {
    id: 201,
    category: 'videos',
    source: 'NCI',
    title: 'NCI Prostate Cancer Treatment Videos',
    description: 'National Cancer Institute video resources on prostate cancer treatment options and patient perspectives.',
    url: 'https://www.cancer.gov/types/prostate/patient/prostate-treatment-pdq',
  },
  {
    id: 202,
    category: 'videos',
    source: 'Mayo Clinic',
    title: 'Mayo Clinic Prostate Cancer Videos',
    description: 'Expert clinical videos from Mayo Clinic specialists about prostate cancer diagnosis and care.',
    url: 'https://www.mayoclinic.org/diseases-conditions/prostate-cancer/videos',
  },
  {
    id: 203,
    category: 'videos',
    source: 'ACS',
    title: 'American Cancer Society Video Library',
    description: 'American Cancer Society patient education videos on prostate cancer prevention and support.',
    url: 'https://www.cancer.org/cancer/types/prostate-cancer/video-library.html',
  },
];

export function Education() {
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<EducationSource[]>(FALLBACK_ARTICLES);
  const [resources, setResources] = useState<EducationSource[]>(FALLBACK_RESOURCES);
  const [videos, setVideos] = useState<EducationSource[]>(FALLBACK_VIDEOS);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourceError, setSourceError] = useState('');

  const faqs = [
    {
      question: 'What is prostate cancer?',
      answer: 'Prostate cancer is a type of cancer that occurs in the prostate gland, a small walnut-shaped gland in men that produces seminal fluid. It is one of the most common types of cancer in men. Many prostate cancers grow slowly and are confined to the prostate gland, where they may not cause serious harm.',
    },
    {
      question: 'What are the risk factors for prostate cancer?',
      answer: 'Key risk factors include: age (risk increases after 50), family history, ethnicity (more common in African American men), obesity, and certain genetic factors. Having one or more risk factors does not mean you will definitely develop prostate cancer.',
    },
    {
      question: 'What is a PSA test?',
      answer: 'PSA (Prostate-Specific Antigen) is a protein produced by the prostate gland. A PSA test measures the level of PSA in your blood. Elevated PSA levels may indicate prostate cancer, but can also be caused by other conditions like benign prostatic hyperplasia (BPH) or prostatitis.',
    },
    {
      question: 'What is a normal PSA level?',
      answer: 'Generally, PSA levels below 4 ng/mL are considered normal. However, normal ranges can vary by age. Levels between 4-10 ng/mL are considered borderline, and levels above 10 ng/mL are considered high. Your doctor will interpret results based on multiple factors.',
    },
    {
      question: 'How often should I get screened?',
      answer: 'Screening recommendations vary. Most medical organizations recommend discussing screening with your doctor starting at age 50, or at age 40-45 if you have risk factors. The frequency depends on your initial PSA level, age, and other factors.',
    },
    {
      question: 'Can prostate cancer be prevented?',
      answer: 'While there is no guaranteed way to prevent prostate cancer, you can reduce your risk by maintaining a healthy weight, exercising regularly, eating a diet rich in fruits and vegetables, and discussing screening with your doctor.',
    },
    {
      question: 'What are the symptoms of prostate cancer?',
      answer: 'Early prostate cancer often has no symptoms. As it progresses, symptoms may include difficulty urinating, weak urine flow, blood in urine or semen, pain in the hips or back, and erectile dysfunction. These symptoms can also be caused by non-cancerous conditions.',
    },
    {
      question: 'Is this risk assessment tool a diagnosis?',
      answer: 'No. This tool provides an estimate of your prostate cancer risk based on known risk factors. It is not a diagnosis and should not replace professional medical advice. Always consult with a healthcare provider for proper diagnosis and treatment.',
    },
  ];

  useEffect(() => {
    const loadSources = async () => {
      setLoadingSources(true);
      setSourceError('');

      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8888';
        const response = await fetch(`${API_BASE_URL}/api/education/sources`);
        if (!response.ok) {
          throw new Error('Unable to fetch live educational sources.');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Source API returned an error.');
        }

        setArticles(Array.isArray(data.articles) && data.articles.length > 0 ? data.articles : FALLBACK_ARTICLES);
        setResources(Array.isArray(data.resources) && data.resources.length > 0 ? data.resources : FALLBACK_RESOURCES);
        setVideos(Array.isArray(data.videos) && data.videos.length > 0 ? data.videos : FALLBACK_VIDEOS);
      } catch (error) {
        setArticles(FALLBACK_ARTICLES);
        setResources(FALLBACK_RESOURCES);
        setVideos(FALLBACK_VIDEOS);
        setSourceError(error instanceof Error ? error.message : 'Failed to load live sources. Showing fallback references.');
      } finally {
        setLoadingSources(false);
      }
    };

    loadSources();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    if (!normalizedQuery) return articles;
    return articles.filter((article) => {
      return (
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.description.toLowerCase().includes(normalizedQuery) ||
        article.source.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [articles, normalizedQuery]);

  const filteredResources = useMemo(() => {
    if (!normalizedQuery) return resources;
    return resources.filter((resource) => {
      return (
        resource.title.toLowerCase().includes(normalizedQuery) ||
        resource.description.toLowerCase().includes(normalizedQuery) ||
        resource.source.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [resources, normalizedQuery]);

  const filteredVideos = useMemo(() => {
    if (!normalizedQuery) return videos;
    return videos.filter((video) => {
      return (
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.description.toLowerCase().includes(normalizedQuery) ||
        video.source.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [videos, normalizedQuery]);

  const filteredFaqs = useMemo(() => {
    if (!normalizedQuery) return faqs;
    return faqs.filter((faq) => {
      return (
        faq.question.toLowerCase().includes(normalizedQuery) ||
        faq.answer.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [faqs, normalizedQuery]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Educational Resources</h1>
        <p className="text-gray-600">Learn about prostate health from trusted medical sources</p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search articles, videos, FAQs, and resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loadingSources && (
          <p className="text-sm text-blue-700">Fetching latest source titles from trusted medical websites...</p>
        )}

        {sourceError && (
          <p className="text-sm text-amber-700">{sourceError}</p>
        )}
      </div>

      <Tabs defaultValue="articles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="articles">
            <FileText className="h-4 w-4 mr-2" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="videos">
            <Video className="h-4 w-4 mr-2" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="faq">
            <BookOpen className="h-4 w-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <div className="grid md:grid-cols-2 gap-6">
            {filteredArticles.map((article) => (
              <Card key={article.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {article.source}
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </div>
                  <CardTitle className="text-lg">{article.title}</CardTitle>
                  <CardDescription>{article.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="link" className="p-0">
                      Read on source website
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredArticles.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">No articles matched your search.</p>
          )}
        </TabsContent>

        <TabsContent value="videos">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <Card key={video.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-md mb-4 flex items-center justify-center">
                    <Video className="h-12 w-12 text-white" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{video.title}</CardTitle>
                      <CardDescription>{video.description}</CardDescription>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full">
                      Watch Videos
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredVideos.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">No videos matched your search.</p>
          )}
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Common questions about prostate health and cancer</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-gray-600">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredFaqs.length === 0 && (
                <p className="text-sm text-gray-500 mt-4">No FAQs matched your search.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid md:grid-cols-2 gap-6">
            {filteredResources.map((resource) => (
              <Card key={resource.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{resource.title}</span>
                    <ExternalLink className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm break-all"
                  >
                    {resource.url}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredResources.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">No resources matched your search.</p>
          )}
        </TabsContent>
      </Tabs>

      <Card className="mt-6 border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900">Medical Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-800">
          <p>
            The information provided here is for educational purposes only and should not be considered medical advice.
            Always consult with a qualified healthcare professional for diagnosis and treatment recommendations.
            If you experience any symptoms or have concerns about your health, please contact your doctor immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
