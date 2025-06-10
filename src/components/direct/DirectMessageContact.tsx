import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import './DirectMessageContact.scss';

const DirectMessageContact: React.FunctionComponent<{
  unread: boolean;
  address: string;
  displayName?: string;
  userIcon?: string;
}> = (props) => {
  let { address } = useParams<{ address: string }>();

  return (
    <Link to={`/messages/${props.address}`}>
      <div
        className={
          'relative direct-message-contact flex flex-row rounded-lg hover:bg-surface-6' +
          (address === props.address ? ' bg-surface-5' : '')
        }
      >
        {props.unread && address !== props.address && (
          <div className="w-1 h-1 mt-4 absolute ml-[-6pt] bg-white rounded-full"></div>
        )}
        <div
          className="direct-message-contact-icon flex flex-col justify-around w-[38px] bg-cover bg-center rounded-full"
          style={{
            backgroundImage: `url(${props.userIcon ?? '/unknown.png'})`,
          }}
        ></div>
        <div className="flex flex-col justify-around">
          <div
            className={
              'direct-message-contact-name text-text-base opacity-80 pl-2 w-[180px] truncate ' +
              (props.unread && address !== props.address
                ? '!font-extrabold'
                : ' ')
            }
          >
            {props.displayName ?? props.address}
          </div>
          {props.displayName && (
            <div className="text-text-base opacity-40 pl-2 text-xs w-[180px] truncate">
              {props.address}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default DirectMessageContact;
