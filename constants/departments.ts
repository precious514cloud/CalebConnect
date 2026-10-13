// CalebConnect
// School Departments / Programmes

export const DEPARTMENTS = [
  'Biochemistry',
  'Microbiology and Industrial Biotechnology',
  'Chemistry',
  'Computer Science',
  'Cybersecurity',
  'Information System and Software Engineering',
  'Architecture',
  'Accounting',
  'Business Administration',
  'Criminology and Security Studies',
  'Economics',
  'International Relations',
  'Psychology',
  'Political Science',
  'Broadcasting',
  'Film and Multimedia Studies',
  'Journalism and Media Studies',
  'Mass Communication',
  'Nursing Science',
  'Anatomy',
  'Medical Laboratory Science',
  'Health Information Management',
  'Information Technology and Health Informatics',
  'Human Nutrition and Dietetics',
  'Public Health and Physiology',
] as const;

export type Department = typeof DEPARTMENTS[number];