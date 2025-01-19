import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './CloseButton.scss';

export default class CloseButton extends React.PureComponent<
  {},
  { children?: React.ReactNode }
> {
  public render() {
    return (
      <div className="close-button">
        <FontAwesomeIcon icon={faTimes} />
      </div>
    );
  }
}
