module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview:ci",
      startServerReadyPattern: "Local:",
      numberOfRuns: 1,
      url: [
        "http://127.0.0.1:4173/",
        "http://127.0.0.1:4173/dashboard",
        "http://127.0.0.1:4173/announcements",
        "http://127.0.0.1:4173/admin/users",
        "http://127.0.0.1:4173/admin/rto",
        "http://127.0.0.1:4173/mechanic-dvir-center",
        "http://127.0.0.1:4173/forms-history/dvir",
      ],
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouse",
      reportFilenamePattern: "lighthouse-%%PATHNAME%%-%%DATETIME%%.html",
    },
    assert: {
      // CI thresholds (current): perf ≥ 0.8, a11y/best-practices/SEO ≥ 0.9.
      // DOE protocol targets (improvement goal): perf ≥ 0.9, accessibility ≥ 0.95.
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
  },
};

