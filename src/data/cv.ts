// CV and teaching facts, transcribed from content/facts.md (section noted on each block).
// Lines facts.md marks VERIFY are left out until Jimmy confirms them.

export interface EducationItem {
  degree: string;
  school: string;
  when: string;
  details?: string[];
}

/** facts.md §4. */
export const EDUCATION: EducationItem[] = [
  {
    degree: 'Ph.D., Human-Centered Computing',
    school: 'University of Florida',
    when: 'Aug 2018 – Dec 2026',
    details: [
      'Dissertation: Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based Automated Identification of Students’ Personal Interests.',
      'Committee: Sharon Lynn Chu (chair), Juan E. Gilbert, Lisa Anthony, Pavlo Antonenko.',
    ],
  },
  {
    degree: 'Doctoral coursework, Electrical Engineering',
    school: 'Texas A&M University',
    when: 'Jan 2017 – May 2018',
  },
  {
    degree: 'Doctoral coursework, Electrical Engineering',
    school: 'University of Houston',
    when: 'Aug 2016 – Dec 2016',
  },
  {
    // TODO(jimmy): degree wording — "B.S., Optical and Electrical Information Engineering" or the
    // diploma's "Bachelor of Engineering, Optoelectronic Information Engineering" (facts.md §4
    // VERIFY). The Summa Cum Laude line also waits on VERIFY.
    degree: 'Bachelor’s degree',
    school: 'Huazhong University of Science and Technology (HUST), China',
    when: 'Sep 2012 – Jun 2016',
    details: [
      'Outstanding Thesis Award (top 1% of undergraduates): Humanoid Robot Behavior Imitation System.',
    ],
  },
];

/** facts.md §2. */
export const STATUS = {
  role: 'Ph.D. candidate, Human-Centered Computing, University of Florida',
  department:
    'Department of Computer & Information Science & Engineering, Herbert Wertheim College of Engineering',
  lab: 'Embodied Learning & Experience (ELX) Lab, advised by Dr. Sharon Lynn Chu',
  labUrl: 'https://elxlab.cise.ufl.edu/',
  advisorUrl: 'https://www.cise.ufl.edu/~slchu/',
  defense: 'Oral defense passed October 2026; Ph.D. to be conferred December 2026.',
} as const;

export interface TeachingItem {
  course: string;
  details: string;
}

/** facts.md §8. "About 150 in total across sections", never "a room of 150". */
export const TEACHING_ASSISTANT = {
  role: 'Teaching Assistant',
  where: 'UF CISE',
  when: 'Aug 2018 – present',
  items: [
    {
      course: 'COP 3530 Data Structures & Algorithms (Fall 2026)',
      details:
        'Weekly discussion sections for about 150 students in total; office hours in person and on Zoom at the same time.',
    },
    {
      course: 'CIS 4360 Computer & Information Security (Spring 2026)',
      details: 'Grading cycles; built a Canvas API gradebook workflow.',
    },
    {
      course:
        'CAP 5100 Human-Computer Interaction and CAP 5108 Research Methods (graduate, co-taught)',
      details: 'Lectures, office hours, rubric design, and course-development feedback to faculty.',
    },
    {
      course: 'Programming class sessions and tutoring',
      details: 'Taught programming class sessions; one-on-one tutoring in office hours.',
    },
  ] satisfies TeachingItem[],
};

/** facts.md §8: teaching before UF. */
export const EARLIER_TEACHING: string[] = [
  'English teacher (part-time) in an after-school program during my B.S.: a class of six elementary-school students for a year and a half.',
  'Tutor in English, mathematics, and science for elementary, middle, and high school students (2012–2016).',
];

/** facts.md §8. */
export const TEACHING_INTERESTS: string[] = [
  'Programming and data structures',
  'HCI and human-centered design',
  'Research methods',
  'Prototyping and physical computing (Arduino, 3D printing, Fusion 360)',
  'AI literacy and checking what AI tools assert',
];

/** facts.md §9. */
export const MENTORING: string[] = [
  'ELX Lab: onboarded and mentored graduate and undergraduate research assistants in qualitative coding, inter-rater reliability, mixed-methods design, and documentation.',
  'Founder and team lead, Galaxy Studio (HUST, 2012–2016), a student hardware/software studio: 8 national and 21 university-level awards; PI on a national-grant undergraduate project.',
];

/** facts.md §10. */
export const HONORS: string[] = [
  'CISE Gartner Group Graduate Fellowship, four times (2021–2024)',
  'Best Short Paper Nomination, IEEE ICALT 2021',
  'Semifinalist, ANA Avatar XPRIZE (2021)',
  'Outstanding Thesis Award (top 1%), HUST, 2016',
];

/** facts.md §12 (SAS is deliberately not listed). */
export const SKILLS: Array<{ area: string; items: string }> = [
  {
    area: 'XR, sensing, teleoperation',
    items:
      'Unity 3D (C#) with external tracking input via a Python bridge; AR smart-glasses apps (Vuzix Blade, Android); YOLO; IMUs (micro:bit, Aimxy); Leap Motion; Kinect; motion-capture teleoperation (NVIDIA Jetson); Tobii Pro Glasses 3; WebGazer.js',
  },
  {
    area: 'AI/ML',
    items:
      'PyTorch, TensorFlow, scikit-learn, OpenCV; LLM pipelines (OpenAI, Claude, Gemini) with structured outputs, retrieval, tool use; sentence-transformer embeddings; grounding audits',
  },
  {
    area: 'Data and study design',
    items:
      'Python (pandas, statsmodels), R, SQL; GEE, multilevel models, ANCOVA, bootstrap/jackknife, Holm and Benjamini–Hochberg control; inter-rater reliability; MAXQDA, Taguette; Qualtrics, MTurk; IRB protocols',
  },
  {
    area: 'Software and hardware',
    items:
      'TypeScript/JavaScript (React), Node.js, Flask, Java/Android, C/C++, C#; Docker Compose, Git; microcontrollers (TI, micro:bit, Jetson), PCB CAD, FPGA, soldering, 3D printing',
  },
];
