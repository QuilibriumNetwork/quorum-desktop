import React, { useState } from 'react';
import ThemeRadioGroup from './ThemeRadioGroup';
import AccentColorSwitcher from './AccentColorSwitcher';
import Button from './Button';
import ToggleSwitch from './ToggleSwitch';
import ReactTooltip from './ReactTooltip';

const Elements = () => {
  const [toggle, setToggle] = React.useState(false);
  const [showTooltipLight, setShowTooltipLight] = useState(false);
  const [showTooltipDark, setShowTooltipDark] = useState(false);

  return (
    <div className="p-12 space-y-12 text-main bg-app min-h-screen">
      <h1 className="text-4xl font-bold">Style Guide</h1>

      <div className="flex flex-wrap items-center gap-12">
        <ThemeRadioGroup horizontal />
        <AccentColorSwitcher />
      </div>

      <section className="card mb-4">
        <h2 className="text-2xl mb-4">Colors</h2>

        {[
          {
            title: 'Primary',
            vars: [
              '--accent-100',
              '--accent-200',
              '--accent-300',
              '--accent-400',
              '--accent-500',
              '--accent-600',
              '--accent-700',
              '--accent-800',
              '--accent-900',
              '--accent',
            ],
          },
          {
            title: 'Surface',
            vars: [
              '--surface-00',
              '--surface-0',
              '--surface-1',
              '--surface-2',
              '--surface-3',
              '--surface-4',
              '--surface-5',
              '--surface-6',
              '--surface-7',
              '--surface-8',
              '--surface-9',
              '--surface-10',
            ],
          },
          {
            title: 'Text',
            vars: ['--text-base', '--text-subtle', '--text-muted'],
          },
          {
            title: 'Utility (HEX)',
            vars: [
              '--danger-hex',
              '--danger-hover-hex',
              '--warning-hex',
              '--success-hex',
              '--info-hex',
            ],
          },
          {
            title: 'Utility (RGB w/ opacity)',
            vars: ['--danger', '--warning', '--success', '--info'].flatMap(
              (name) =>
                [1, 0.75, 0.5, 0.25].map((opacity) => ({
                  label: `${name} / ${opacity}`,
                  bg: `rgba(var(${name}), ${opacity})`,
                }))
            ),
          },
        ].map(({ title, vars }) => (
          <div key={title} className="mb-8">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-4">
              {(typeof vars[0] === 'string'
                ? (vars as string[]).map((v) => ({
                    label: v,
                    bg: `var(${v})`,
                  }))
                : (vars as { label: string; bg: string }[])
              ).map(({ label, bg }) => (
                <div
                  key={label}
                  className="p-2 rounded shadow flex items-center justify-center text-center text-xs font-mono"
                  style={{
                    backgroundColor: bg,
                    color: 'var(--color-text-main)',
                    minHeight: '3rem',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            {title === 'Utility (RGB w/ opacity)' && (
              <p className="mt-2 text-sm text-subtle">
                <span className="italic">
                  Use{' '}
                  <code className="font-mono not-italic text-[rgba(var(--warning),0.8)]">
                    rgba(var(--color), 0.5)
                  </code>{' '}
                  in CSS/JSX, or{' '}
                  <code className="font-mono not-italic text-[rgba(var(--warning),0.8)]">
                    bg-[rgba(var(--color),0.5)]
                  </code>{' '}
                  in Tailwind className.
                </span>
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="card mb-4">
        <h2 className="text-2xl mb-2">Typography</h2>
        <div className="flex flex-row items-center gap-6">
          <p className="text-base">Base text</p>
          <p className="text-subtle">Subtle text</p>
          <p className="text-muted">Muted text</p>
          <p className="small-caps">Small Caps Text</p>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="text-2xl mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button type="primary" onClick={() => {}}>
            Primary
          </Button>
          <Button type="secondary" onClick={() => {}}>
            Secondary
          </Button>
          <Button type="light" onClick={() => {}}>
            Light
          </Button>
          <Button type="light-outline" onClick={() => {}}>
            Light Outline
          </Button>
          <Button type="danger" onClick={() => {}}>
            Danger
          </Button>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="text-2xl mb-4">Toggle Switch</h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span>Off</span>
            <ToggleSwitch active={false} onClick={() => setToggle(false)} />
          </div>
          <div className="flex items-center gap-2">
            <span>On</span>
            <ToggleSwitch active={true} onClick={() => setToggle(true)} />
          </div>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="text-2xl mb-4">Tooltips</h2>
        <div className="flex gap-12">
          <div>
            <span
              id="hover-light-tooltip-anchor"
              className="underline cursor-pointer"
            >
              Hover me (Top)
            </span>
            <ReactTooltip
              id="hover-light-tooltip"
              content="I’m a top tooltip!"
              place="top"
              anchorSelect="#hover-light-tooltip-anchor"
            />
          </div>

          <div>
            <span
              id="hover-dark-tooltip-anchor"
              className="underline cursor-pointer"
            >
              Hover me (Right)
            </span>
            <ReactTooltip
              id="hover-dark-tooltip"
              content="I’m a right tooltip!"
              place="right"
              anchorSelect="#hover-dark-tooltip-anchor"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Elements;
