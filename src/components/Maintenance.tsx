import React from 'react';
import Button from './Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTools } from '@fortawesome/free-solid-svg-icons';
import { Trans } from '@lingui/react/macro';

export const Maintenance = () => {
  return (
    <>
      <div className="flex flex-col grow"></div>
      <div className="flex flex-col select-none ">
        <div className="flex flex-row grow"></div>
        <div className="flex flex-row grow font-semibold text-2xl">
          <div className="flex flex-col grow"></div>
          <div className="flex flex-col text-white">
            <Trans>Maintenance in Progress</Trans>
          </div>
          <div className="flex flex-col grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] py-4 text-center text-white">
            <FontAwesomeIcon size="4x" icon={faTools} />
          </div>
          <div className="grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] py-4 text-justify text-white">
            <Trans>
              Quorum infrastructure is being deployed at this time. Please try
              refreshing, and check{' '}
              <a
                href="https://status.quilibrium.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline"
              >
                https://status.quilibrium.com/
              </a>{' '}
              for updates.
            </Trans>
          </div>
          <div className="grow"></div>
        </div>
        <div className="flex flex-row justify-center">
          <div className="grow"></div>
          <div className="w-[460px] pt-4 text-center">
            <Button
              type="light"
              className="px-8"
              onClick={() => window.location.reload()}
            >
              <Trans>Refresh</Trans>
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
