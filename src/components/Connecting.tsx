import * as React from 'react';

import './Connecting.scss';

const Connecting = () => {
  return (
    <div className="connecting-splash">
      <div
        className="connecting-icon"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-1"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-2"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-3"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-4"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-5"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <div
        className="connecting-icon connecting-icon-6"
        style={{ backgroundImage: "url('/quorumicon.png')" }}
      ></div>
      <br />
      <div className="connecting-message">Connecting</div>
    </div>
  );
};

export default Connecting;
