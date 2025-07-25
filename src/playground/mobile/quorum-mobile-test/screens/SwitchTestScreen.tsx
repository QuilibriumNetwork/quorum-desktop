import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Switch } from '../components/primitives/Switch';

export const SwitchTestScreen: React.FC = () => {
  const [basicSwitch, setBasicSwitch] = useState(false);
  const [disabledSwitchOff, setDisabledSwitchOff] = useState(false);
  const [disabledSwitchOn, setDisabledSwitchOn] = useState(true);
  
  const [mobileSwitch, setMobileSwitch] = useState(true);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a1a', padding: 20 }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
        Switch Primitive
      </Text>
      <Text style={{ color: '#888', fontSize: 16, marginBottom: 30 }}>
        Cross-platform toggle switch with multiple sizes and variants
      </Text>

      <View style={{ marginBottom: 30 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
          Basic Switch
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Switch
            value={basicSwitch}
            onChange={setBasicSwitch}
            accessibilityLabel="Basic Switch (OFF)"
          />
          <Text style={{ color: 'white', marginLeft: 15 }}>
            Basic Switch ({basicSwitch ? 'ON' : 'OFF'})
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Switch
            value={disabledSwitchOff}
            onChange={setDisabledSwitchOff}
            disabled={true}
            accessibilityLabel="Disabled Switch (OFF)"
          />
          <Text style={{ color: '#888', marginLeft: 15 }}>
            Disabled Switch (OFF) - Cannot be toggled
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Switch
            value={disabledSwitchOn}
            onChange={setDisabledSwitchOn}
            disabled={true}
            accessibilityLabel="Disabled Switch (ON)"
          />
          <Text style={{ color: '#888', marginLeft: 15 }}>
            Disabled Switch (ON) - Cannot be toggled
          </Text>
        </View>
      </View>

      <View style={{ marginBottom: 30 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
          Mobile Switch Size
        </Text>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <Switch
            value={mobileSwitch}
            onChange={setMobileSwitch}
            accessibilityLabel="Mobile Switch"
          />
          <Text style={{ color: 'white', marginLeft: 15 }}>
            Standard Mobile Size (52×28px - matches platform guidelines)
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#333', padding: 15, borderRadius: 8 }}>
        <Text style={{ color: '#4ade80', fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>
          📱 Mobile Testing Notes
        </Text>
        <Text style={{ color: '#ccc', fontSize: 12, lineHeight: 18 }}>
          • Web: Custom styled switch with smooth animations and accent color{'\n'}
          • Mobile: Custom switch component (no Android ripple effects){'\n'}
          • Single size optimized for mobile (52×28px matches platform standards){'\n'}
          • Uses theme-aware surface colors (adapts to light/dark themes){'\n'}
          • Touch targets are optimized for mobile accessibility{'\n'}
          • Smooth animated transitions with proper spacing consistency
        </Text>
      </View>
    </ScrollView>
  );
};