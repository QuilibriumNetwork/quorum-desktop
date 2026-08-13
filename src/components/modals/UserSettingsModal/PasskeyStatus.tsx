import * as React from 'react';
import { t } from '@lingui/core/macro';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { Callout, Modal } from '../../primitives';
import { isElectron } from '../../../utils/platform';

/**
 * Warns when the account key is NOT protected by a passkey. Renders nothing at
 * all when it is.
 *
 * Silence means protected, matching SyncStatusLine in this same folder. A
 * green "you are secure" banner would be permanent furniture on the healthy
 * path, and permanent furniture stops being read — which is exactly the
 * attention this warning needs when it does appear.
 *
 * Sits directly above Account Key, and that placement is the point: in the
 * unprotected state the only mitigation available today is the key backup in
 * the section immediately below, so the warning and its remedy are read
 * together.
 *
 * ## How the state is read
 *
 * The SDK writes the literal string `not-passkey` as the credential id when
 * registration takes the fallback path (`dist/index.js:6019-6021`), and the
 * real credential id when a passkey holds the key. So the credential id is the
 * discriminator and nothing new has to be plumbed or stored.
 *
 * Electron is always on the fallback path — the SDK forces it unconditionally
 * — so this renders the warning state there for every user, which is correct
 * and is currently the only place in the product that says so.
 *
 * ## Why there is no "Set up a passkey" button
 *
 * There is no way to attach a passkey to an account that already exists.
 * `usePasskeyFlow.startRegistration()` looks reusable from here, but it calls
 * `getOrGenerateKeypair()`, which reads an in-memory ref only populated during
 * an onboarding session. For an already-onboarded user that ref is empty, so it
 * generates a **new Ed448 keypair** and derives a different address: a second
 * account, not an upgraded one. A button wired to it would tell the user they
 * had just secured their account while quietly creating a different one, which
 * they could not detect by using the app.
 *
 * The migration that does work goes through the key file, which is why the
 * modal explains a procedure instead of offering an action. Adding a real
 * in-place upgrade needs an SDK change.
 */
const PasskeyStatus: React.FunctionComponent<{ className?: string }> = ({
  className,
}) => {
  const { currentPasskeyInfo } = usePasskeysContext();
  const [showHelp, setShowHelp] = React.useState(false);

  // No account yet: onboarding has not stored credentials, so there is no
  // protection state to report and a warning would be noise.
  if (!currentPasskeyInfo?.credentialId) return null;

  // Protected. Say nothing.
  if (currentPasskeyInfo.credentialId !== 'not-passkey') return null;

  return (
    <div className={className}>
      {/*
        No <Icon> here. Callout renders its own variant icon (`variantIcons`
        in the shared primitive), so adding the matching one gives two
        triangles side by side.
      */}
      <Callout variant="warning" size="sm" className="w-full">
        {/*
          `text-sm` on both the text and the link, not just the wrapper. A bare
          <button> keeps the UA font-size under Tailwind's preflight
          (`font-size: 100%`), which does not resolve to the callout's size, so
          the link rendered visibly larger than the sentence it sits in.
        */}
        <div className="text-sm">
          {t`No passkey on this account. Your account key is stored on this device, so anyone who can read its files could take over your account.`}{' '}
          {/*
            `link-inline` (src/styles/_base.scss) takes the size, weight and
            colour of the sentence it sits in. A <button> rather than an <a>
            because it performs an action; `link-inline` is what makes a button
            stop looking like one.
          */}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="link-inline"
          >
            {t`How to add a passkey`}
          </button>
        </div>
      </Callout>

      {/*
        A modal rather than a tooltip, deliberately. This is a procedure with a
        destructive branch in it, so it has to survive being read twice, and a
        tooltip that vanishes on mouse-out cannot carry the sentence about what
        a backup does not cover.
      */}
      {/*
        `modal-keeps-title` is required, not decorative. This modal opens from
        inside the settings modal, and `.modal-complex-wrapper .quorum-modal-title`
        sets `display: none` on every title nested in there. Without the opt-in
        the title renders in the DOM and is invisible on screen.
      */}
      <Modal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
        title={t`Add a passkey`}
        size="small"
        className="modal-keeps-title"
      >
        {/*
          No Close button. The X and the backdrop already close this, and a
          third way to dismiss reads as a decision the user has to make.
        */}
        <div className="flex flex-col gap-3 text-sm">
          <div>
            {t`A passkey keeps your account key in your device's hardware, unlocked by your fingerprint, face or PIN.`}
          </div>

          {isElectron() ? (
            <>
              {/*
                Electron never gets a passkey: the SDK forces the fallback path
                on `window.electron` unconditionally. So the reset instructions
                below would destroy Space history and still leave this user
                without a passkey. They need a browser, not a reset.
              */}
              <div>
                {t`Quorum for desktop cannot use passkeys. To protect your account key with one, set your account up in a web browser using your key file.`}
              </div>
              <ol className="list-decimal ml-5 flex flex-col gap-1">
                <li>{t`Security tab > Account Key: choose Download file.`}</li>
                <li>{t`Open Quorum in your browser and import that file.`}</li>
                <li>{t`Create the passkey when asked.`}</li>
              </ol>
              <div>
                {t`You keep the same account and address, and this desktop app carries on working.`}
              </div>
            </>
          ) : (
            <>
              <div>
                {t`It can only be created while an account is being set up, so adding one means setting this account up again from your key file.`}
              </div>
              <ol className="list-decimal ml-5 flex flex-col gap-1">
                <li>{t`Security tab > Account Key: choose Download file.`}</li>
                <li>{t`Security tab > Data Backup: export a backup.`}</li>
                <li>{t`Danger Zone: reset the app.`}</li>
                <li>{t`Set up again, import your key file, and create the passkey when asked.`}</li>
              </ol>
              <Callout variant="warning" size="sm">
                <div className="text-sm">
                  {/*
                    Matches the export confirmation's own wording rather than
                    inventing a second account of what a backup covers. Two
                    modals disagreeing about what survives a reset is worse than
                    either being slightly imprecise.
                  */}
                  {t`Keep the key file somewhere safe until you are through: after the reset it is the only way back into your account.`}
                </div>
              </Callout>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PasskeyStatus;
