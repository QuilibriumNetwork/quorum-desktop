import * as React from 'react';
import { Icon } from '../primitives';
import './CloseButton.scss';

export default class CloseButton extends React.PureComponent<
  {},
  { children?: React.ReactNode }
> {
  public render() {
    return (
      <div className="close-button">
        <Icon name="close" />
      </div>
    );
  }
}
