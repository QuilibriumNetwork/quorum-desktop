import React from 'react';
import Button from './Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTools } from '@fortawesome/free-solid-svg-icons';

export const Maintenance = () => {
  return (
    <>
      <div className="flex flex-col grow"></div>
      <div className="flex flex-col select-none">
        <div className="flex flex-row grow"></div>
        <div className="flex flex-row grow font-semibold text-2xl">
          <div className="flex flex-col grow"></div>
          <div className="flex flex-col">Maintenance in Progress</div>
          <div className="flex flex-col grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] py-4 text-center">
            <FontAwesomeIcon size="4x" icon={faTools} />
          </div>
          <div className="grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] py-4 text-justify">
            Quorum infrastructure is being deployed at this time. Please try
            refreshing, and check https://status.quilibrium.com/ for updates.
          </div>
          <div className="grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] pt-4 text-center">
            <Button
              type="primary"
              className="px-8"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          </div>
          <div className="grow"></div>
        </div>
        <div className="flex flex-row grow"></div>
      </div>
      <div className="flex flex-col grow"></div>
    </>
  );
};
