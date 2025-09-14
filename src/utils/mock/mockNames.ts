/**
 * Diverse collection of names from various cultures for mock user generation
 * Used in development/testing to create more realistic user lists
 */

export const MOCK_NAMES = [
  // East Asian
  'Akira', 'Yuki', 'Kenji', 'Sakura', 'Hiroshi', 'Mei', 'Takeshi', 'Hana',
  'Ren', 'Sato', 'Wei', 'Lin', 'Chen', 'Xing', 'Li', 'Jun',

  // South Asian
  'Priya', 'Arjun', 'Ravi', 'Anita', 'Raj', 'Kavya', 'Amit', 'Shreya',
  'Vikram', 'Nisha', 'Rohan', 'Devi', 'Kiran', 'Maya',

  // European
  'Emma', 'Luca', 'Sofia', 'Magnus', 'Astrid', 'Lars', 'Olaf', 'Ingrid',
  'Marco', 'Elena', 'Diego', 'Aria', 'Niko', 'Zara', 'Felix', 'Nina',
  'Anton', 'Freya', 'Erik', 'Isla',

  // African
  'Amara', 'Kenzo', 'Jabari', 'Nia', 'Kofi', 'Aisha', 'Kwame', 'Nala',
  'Bakari', 'Zuri', 'Jengo', 'Kaia', 'Tau', 'Asha', 'Omari', 'Safiya',

  // Middle Eastern
  'Omar', 'Layla', 'Hassan', 'Noor', 'Tariq', 'Amina', 'Samir', 'Yasmin',
  'Khalil', 'Zahra', 'Faris', 'Lina', 'Karim', 'Mira',

  // Latin American
  'Carlos', 'Isabella', 'Miguel', 'Lucia', 'Pablo', 'Carmen', 'Alejandro',
  'Esperanza', 'Rafael', 'Valeria', 'Mateo', 'Camila', 'Jorge', 'Ana',

  // Native/Indigenous
  'Dakota', 'Phoenix', 'River', 'Sky', 'Storm', 'Wolf', 'Sage', 'Rain',
  'Cedar', 'Luna', 'Arrow', 'Dawn',

  // Slavic
  'Dimitri', 'Katya', 'Alexei', 'Anya', 'Ivan', 'Olga', 'Pavel', 'Vera',
  'Boris', 'Tanya', 'Mikhail', 'Sasha',

  // Celtic/Gaelic
  'Connor', 'Siobhan', 'Declan', 'Aoife', 'Finn', 'Niamh', 'Cian', 'Roisin',
  'Eoin', 'Ciara', 'Oisin', 'Ailish',

  // Nordic
  'Bjorn', 'Sigrid', 'Gunnar', 'Thora', 'Leif', 'Astrid', 'Ragnar', 'Frida',

  // Additional diverse names
  'Kai', 'Zion', 'Aria', 'Neo', 'Nova', 'Orion', 'Indigo', 'Atlas',
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