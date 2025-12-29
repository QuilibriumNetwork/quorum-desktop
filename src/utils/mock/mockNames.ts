/**
 * Diverse collection of names from various cultures for mock user generation
 * Used in development/testing to create more realistic user lists
 */

export const MOCK_NAMES = [
  // East Asian (single + full names)
  'Akira', 'Yuki Tanaka', 'Kenji', 'Sakura Yamamoto', 'Hiroshi', 'Mei Chen',
  'Takeshi Nakamura', 'Hana', 'Ren', 'Sato Kimura', 'Wei Zhang', 'Lin',

  // South Asian (single + full names)
  'Priya Sharma', 'Arjun', 'Ravi Kumar', 'Anita', 'Raj Patel', 'Kavya',
  'Amit Verma', 'Shreya Gupta', 'Vikram Singh', 'Nisha', 'Rohan Mehta', 'Maya',

  // European (single + full names)
  'Emma', 'Luca Rossi', 'Sofia Martinez', 'Magnus Eriksson', 'Astrid', 'Lars',
  'Marco Bianchi', 'Elena Petrova', 'Diego', 'Aria', 'Niko Papadopoulos', 'Zara',
  'Felix Schneider', 'Nina', 'Anton', 'Freya Andersson', 'Erik', 'Isla MacLeod',

  // African (single + full names)
  'Amara Diallo', 'Kenzo', 'Jabari Okonkwo', 'Nia', 'Kofi Mensah', 'Aisha',
  'Kwame Asante', 'Nala', 'Bakari', 'Zuri Ndegwa', 'Tau', 'Omari Hassan',

  // Middle Eastern (single + full names)
  'Omar Al-Rashid', 'Layla', 'Hassan Mahmoud', 'Noor', 'Tariq', 'Amina Khalil',
  'Samir', 'Yasmin Al-Farsi', 'Khalil', 'Zahra Nazari', 'Faris', 'Karim',

  // Latin American (single + full names)
  'Carlos Rodriguez', 'Isabella', 'Miguel', 'Lucia Fernandez', 'Pablo',
  'Carmen Sanchez', 'Alejandro Morales', 'Esperanza', 'Rafael', 'Valeria',
  'Mateo Garcia', 'Camila', 'Jorge Hernandez', 'Ana',

  // Long/Complex names for truncation testing
  'Alexander Maximilian', 'Bartholomew', 'Christopherson', 'Evangelina Maria',
  'Fitzgerald James', 'Guadalupe Esperanza', 'Hieronymus', 'Konstantinos',
  'Maria Alejandra Fernandez', 'Nathaniel Christopher', 'Oluwaseun Adebayo',
  'Persephone Aurora', 'Rajeshwari Venkataraman', 'Seraphina Celestine',
  'Theofilos Alexandros', 'Uchechukwu Nnamdi', 'Valentina Isabella',
  'Wolfeschlegelsteinhausen', 'Xiomara Esperanza', 'Yekaterina Alexandrovna',

  // Native/Indigenous (single + full names)
  'Dakota', 'Phoenix Rising', 'River Stone', 'Sky', 'Storm Cloud', 'Wolf',
  'Sage', 'Rain Walker', 'Cedar', 'Luna', 'Arrow', 'Dawn',

  // Slavic (single + full names)
  'Dimitri Volkov', 'Katya', 'Alexei Petrov', 'Anya', 'Ivan Kozlov', 'Olga',
  'Pavel Sokolov', 'Vera', 'Boris Ivanov', 'Tanya', 'Mikhail', 'Sasha',

  // Celtic/Gaelic (single + full names)
  'Connor O\'Brien', 'Siobhan', 'Declan Murphy', 'Aoife', 'Finn MacCarthy',
  'Niamh', 'Cian', 'Roisin', 'Eoin', 'Ciara', 'Oisin', 'Ailish',

  // Nordic (single + full names)
  'Bjorn Larsson', 'Sigrid', 'Gunnar', 'Thora Johansson', 'Leif', 'Ragnar',

  // Additional diverse names
  'Kai', 'Zion', 'Neo', 'Nova Starlight', 'Orion', 'Indigo', 'Atlas',
] as const;

/**
 * Get a mock name by index, cycling through the available names
 */
export function getMockName(index: number): string {
  return MOCK_NAMES[index % MOCK_NAMES.length];
}

/**
 * Get total count of available mock names
 */
export function getMockNameCount(): number {
  return MOCK_NAMES.length;
}