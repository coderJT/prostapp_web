const express = require('express');

const router = express.Router();

const SOURCE_CATALOG = [
  {
    category: 'articles',
    source: 'NCI',
    url: 'https://www.cancer.gov/types/prostate',
    description: 'National Cancer Institute overview of prostate cancer basics, risk factors, diagnosis, and treatment.',
  },
  {
    category: 'articles',
    source: 'CDC',
    url: 'https://www.cdc.gov/cancer/prostate/index.htm',
    description: 'CDC educational information on prostate cancer and screening conversations.',
  },
  {
    category: 'articles',
    source: 'ACS',
    url: 'https://www.cancer.org/cancer/types/prostate-cancer.html',
    description: 'American Cancer Society resource hub for prevention, detection, staging, and treatment options.',
  },
  {
    category: 'resources',
    source: 'Mayo Clinic',
    url: 'https://www.mayoclinic.org/diseases-conditions/prostate-cancer/symptoms-causes/syc-20353087',
    description: 'Clinical symptom and risk-factor information for patients and families.',
  },
  {
    category: 'resources',
    source: 'PCF',
    url: 'https://www.pcf.org/patient-resources/',
    description: 'Patient-focused support resources from the Prostate Cancer Foundation.',
  },
  {
    category: 'resources',
    source: 'Urology Care Foundation',
    url: 'https://www.urologyhealth.org/urology-a-z/p/prostate-cancer',
    description: 'Patient education content from urology specialists.',
  },
];

const VIDEO_CATALOG = [
  {
    category: 'videos',
    source: 'NCI',
    url: 'https://www.cancer.gov/types/prostate/patient/prostate-treatment-pdq',
    title: 'NCI Prostate Cancer Treatment Videos',
    description: 'National Cancer Institute video resources on prostate cancer treatment options and patient perspectives.',
  },
  {
    category: 'videos',
    source: 'Mayo Clinic',
    url: 'https://www.mayoclinic.org/diseases-conditions/prostate-cancer/videos',
    title: 'Mayo Clinic Prostate Cancer Videos',
    description: 'Expert clinical videos from Mayo Clinic specialists about prostate cancer diagnosis and care.',
  },
  {
    category: 'videos',
    source: 'ACS',
    url: 'https://www.cancer.org/cancer/types/prostate-cancer/video-library.html',
    title: 'American Cancer Society Video Library',
    description: 'American Cancer Society patient education videos on prostate cancer prevention and support.',
  },
];

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1]) return null;
  return titleMatch[1].replace(/\s+/g, ' ').trim();
}

async function fetchPageTitle(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ProstAPP-EducationBot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractTitle(html);
  } catch {
    return null;
  }
}

router.get('/sources', async (_req, res) => {
  try {
    const resolved = await Promise.all(
      SOURCE_CATALOG.map(async (item, index) => {
        const liveTitle = await fetchPageTitle(item.url);
        return {
          id: index + 1,
          category: item.category,
          source: item.source,
          title: liveTitle || `${item.source} Prostate Cancer Resource`,
          description: item.description,
          url: item.url,
        };
      })
    );

    const videoResolved = await Promise.all(
      VIDEO_CATALOG.map(async (item, index) => {
        const liveTitle = await fetchPageTitle(item.url);
        return {
          id: 200 + index + 1,
          category: item.category,
          source: item.source,
          title: liveTitle || item.title,
          description: item.description,
          url: item.url,
        };
      })
    );

    const articles = resolved.filter((item) => item.category === 'articles');
    const resources = resolved.filter((item) => item.category === 'resources');
    const videos = videoResolved.filter((item) => item.category === 'videos');

    res.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      articles,
      resources,
      videos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      articles: [],
      resources: [],
      videos: [],
    });
  }
});

module.exports = router;
