import * as React from 'react';
import { Trans } from "@lingui/react/macro";

import './Connecting.scss';

const Connecting = () => {
  return (
    <div className="connecting-splash bg-app">
      <div
        className="connecting-icon pulse"
        style={{ backgroundImage: "url('/quorumicon-blue.png')" }}
      ></div>
      <div className="connecting-message"><Trans>Connecting</Trans></div>
    </div>
  );
};

//OLD SPINNER ANIMATION
// const Connecting = () => {
//   return (
//     <div className="connecting-splash">
//       <div
//         className="connecting-icon"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-1"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-2"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-3"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-4"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-5"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <div
//         className="connecting-icon connecting-icon-6"
//         style={{ backgroundImage: "url('/quorumicon.png')" }}
//       ></div>
//       <br />
//       <div className="connecting-message">Connecting</div>
//     </div>
//   );
// };

export default Connecting;
