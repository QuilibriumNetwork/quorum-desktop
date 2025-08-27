import * as React from 'react';
import './Container.scss';

export default class Container extends React.PureComponent<
  { children?: React.ReactNode },
  {}
> {
  public render() {
    return <div className="container-unit">{this.props.children}</div>;
  }
}
