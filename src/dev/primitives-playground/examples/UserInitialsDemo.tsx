import React from 'react';
import { UserInitials } from '../../../components/user/UserInitials';

// Desaturated colors (25% less saturation) - matching avatar.ts palette
const DEMO_COLORS = [
  // Blues
  { color: '#5f8eeb', label: 'Blue 500', displayName: 'Alice Johnson' }, // AJ
  { color: '#4970e0', label: 'Blue 600', displayName: 'Михаил' }, // М (Cyrillic)
  { color: '#42aad9', label: 'Sky 500', displayName: '5678' }, // 5
  { color: '#378dc0', label: 'Sky 600', displayName: 'Sarah King' }, // SK

  // Greens
  { color: '#40b589', label: 'Green 500', displayName: '陳偉' }, // 陳 (Chinese)
  { color: '#357671', label: 'Green 600', displayName: 'George Roberts' }, // GR
  { color: '#47b0a8', label: 'Teal 500', displayName: 'דוד' }, // ד (Hebrew)
  { color: '#3d948e', label: 'Teal 600', displayName: '3456' }, // 3
  { color: '#8dbc4b', label: 'Lime 500', displayName: 'Lisa Martin' }, // LM
  { color: '#759b3d', label: 'Lime 600', displayName: 'أحمد' }, // أ (Arabic)

  // Purples & Violets
  { color: '#9673ea', label: 'Purple 500', displayName: 'Paul Richards' }, // PR
  { color: '#8858e1', label: 'Violet 500', displayName: 'Ωμέγα' }, // Ω (Greek)
  { color: '#7579e6', label: 'Indigo 500', displayName: '7890' }, // 7
  { color: '#6559da', label: 'Indigo 600', displayName: 'Ian Nelson' }, // IN
  { color: '#af6cf1', label: 'Purple 600', displayName: 'กนก ขจิต' }, // กข (Thai)
  { color: '#9e50dd', label: 'Purple 700', displayName: 'Павел' }, // П (Cyrillic)

  // Pinks & Reds
  { color: '#e4649f', label: 'Pink 500', displayName: 'Patricia Kelly' }, // PK
  { color: '#d14882', label: 'Pink 600', displayName: '山田' }, // 山 (Japanese)
  { color: '#e85c76', label: 'Rose 500', displayName: '2345' }, // 2
  { color: '#d63e5c', label: 'Rose 600', displayName: 'Rachel Sanders' }, // RS
  { color: '#e7615d', label: 'Red 500', displayName: 'Σίγμα' }, // Σ (Greek)
  { color: '#d04545', label: 'Red 600', displayName: 'Robert Davis' }, // RD

  // Oranges & Yellows
  { color: '#eba03f', label: 'Amber 500', displayName: 'Alex Morgan' }, // AM
  { color: '#ce8336', label: 'Amber 600', displayName: 'הנה' }, // ה (Hebrew)
  { color: '#ec814a', label: 'Orange 500', displayName: '9012' }, // 9
  { color: '#dc6738', label: 'Orange 600', displayName: 'Oliver Reed' }, // OR

  // Magentas & Fuchsias
  { color: '#df65e4', label: 'Fuchsia 500', displayName: '李明' }, // 李 (Chinese)
  { color: '#c54cc7', label: 'Fuchsia 600', displayName: 'Frank Cooper' }, // FC
  { color: '#e594ed', label: 'Fuchsia 400', displayName: 'Дмитрий' }, // Д (Cyrillic)

  // Cyans & Aqua
  { color: '#3aafc9', label: 'Cyan 500', displayName: 'Chris Young' }, // CY
  { color: '#3393ae', label: 'Cyan 600', displayName: 'ขวัญ' }, // ข (Thai)
  { color: '#5dcce0', label: 'Cyan 400', displayName: '1234' }, // 1
];

export const UserInitialsDemo: React.FC = () => {
  return (
    <section id="user-initials-demo">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">User Initials</h2>
          <p className="text-subtle">
            Colored avatars with subtle gradients. Colors are desaturated by 25% for a softer appearance.
            Each avatar uses a 5% lighter shade at the top and 10% darker shade at the bottom for depth.
          </p>
        </div>

        <div className="grid grid-cols-8 gap-6 p-6 bg-surface-1 rounded-lg">
          {DEMO_COLORS.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2"
            >
              <UserInitials
                name={item.displayName}
                backgroundColor={item.color}
                size={48}
              />
              <span className="text-xs text-subtle text-center leading-tight">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
