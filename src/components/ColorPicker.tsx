import React, { CSSProperties } from 'react';
import Sketch from '@uiw/react-color-sketch';
import { SwatchPresetColor } from '@uiw/react-color-swatch';
import { ColorResult } from '@uiw/color-convert'


type ColorPickerProps = {
    color: string,
    style?: CSSProperties,
    presetColors: false | SwatchPresetColor[],
    disableAlpha?: boolean,
    onChange: (color: ColorResult) => void
}

function ColorPicker({ color, style, presetColors, disableAlpha = true, onChange}: ColorPickerProps) {
    return (
      <div>
          <Sketch
            style={style}
            color={color}
            presetColors={presetColors}
            disableAlpha={disableAlpha}
            onChange={onChange}
          />
      </div>
    );
  }

  export default ColorPicker;