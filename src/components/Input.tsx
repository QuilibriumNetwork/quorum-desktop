import React from 'react';

import './Input.scss';

type InputProps = {
  placeholder?: string | undefined;
  value?: string | undefined;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  className?: string | undefined;
};

const Input: React.FunctionComponent<InputProps> = (props) => {
  return (
    <input
      className={'quorum-input ' + props.className}
      value={props.value}
      placeholder={props.placeholder}
      onChange={props.onChange}
    />
  );
};

export default Input;
