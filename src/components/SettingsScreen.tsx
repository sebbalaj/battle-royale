import type { Campaign, Settings, WeaponType } from "../types";
import { WEAPON_NAMES } from "../weapons";
import NumberField from "./NumberField";

type SettingsScreenProps = {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
  onBack: () => void;
};

export default function SettingsScreen({ campaign, onChange, onBack }: SettingsScreenProps) {
  const settings = campaign.settings;

  const update = (patch: Partial<Settings>) => {
    onChange({ ...campaign, settings: { ...settings, ...patch } });
  };

  const updateWeaponBonus = (weapon: WeaponType, value: number) => {
    update({ weaponBonuses: { ...settings.weaponBonuses, [weapon]: value } });
  };

  return (
    <main className="app-shell settings-screen">
      <header className="hero">
        <div>
          <p className="eyebrow">Tune the rules</p>
          <h1>Settings</h1>
          <p className="hero-copy">Adjust every value the engine uses. Settings are saved with the campaign but are not part of layout slots.</p>
        </div>
        <button className="secondary-button" onClick={onBack}>Back to setup</button>
      </header>

      <section className="panel setup-section">
        <div className="section-heading"><div><span className="step-number">A</span><h2>Movement and power</h2></div></div>
        <div className="settings-grid">
          <NumberField label="Stay chance (0–1)" value={settings.stayChance} step={0.05} min={0} max={1} hint="Chance a character stays put each round." onChange={(value) => update({ stayChance: value })} />
          <NumberField label="Power change min" value={settings.powerChangeMin} onChange={(value) => update({ powerChangeMin: value })} />
          <NumberField label="Power change max" value={settings.powerChangeMax} onChange={(value) => update({ powerChangeMax: value })} />
          <NumberField label="Starting power" value={settings.startingPower} min={1} hint="Power each character starts a battle with." onChange={(value) => update({ startingPower: value })} />
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading"><div><span className="step-number">B</span><h2>Combat and escapes</h2></div></div>
        <div className="settings-grid">
          <NumberField label="Death chance base (0–1)" value={settings.deathChanceBase} step={0.05} min={0} max={1} onChange={(value) => update({ deathChanceBase: value })} />
          <NumberField label="Death chance per power gap" value={settings.deathChancePerPower} step={0.01} min={0} max={1} onChange={(value) => update({ deathChancePerPower: value })} />
          <NumberField label="Low-power death bonus" value={settings.deathChanceLowPowerBonus} step={0.05} min={0} max={1} hint="Added when the loser is at 2 power or less." onChange={(value) => update({ deathChanceLowPowerBonus: value })} />
          <NumberField label="Winner damage cap (0–1)" value={settings.winnerDamageCapPct} step={0.05} min={0} max={1} hint="Share of winner's power lost at most." onChange={(value) => update({ winnerDamageCapPct: value })} />
          <NumberField label="Escape power min" value={settings.escapePowerMin} min={0} onChange={(value) => update({ escapePowerMin: value })} />
          <NumberField label="Escape power max" value={settings.escapePowerMax} min={0} onChange={(value) => update({ escapePowerMax: value })} />
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading"><div><span className="step-number">C</span><h2>Weapons (secret power bonus)</h2></div></div>
        <p className="helper-text">Bonuses add to combat odds but never show on the map. The sniper has no combat bonus; it fires at range instead.</p>
        <div className="settings-grid">
          <NumberField label={`${WEAPON_NAMES.shotgun} bonus`} value={settings.weaponBonuses.shotgun} onChange={(value) => updateWeaponBonus("shotgun", value)} />
          <NumberField label={`${WEAPON_NAMES["suppressed-pistol"]} bonus`} value={settings.weaponBonuses["suppressed-pistol"]} onChange={(value) => updateWeaponBonus("suppressed-pistol", value)} />
          <NumberField label={`${WEAPON_NAMES.knife} bonus`} value={settings.weaponBonuses.knife} onChange={(value) => updateWeaponBonus("knife", value)} />
          <NumberField label={`${WEAPON_NAMES.sniper} bonus`} value={settings.weaponBonuses.sniper} onChange={(value) => updateWeaponBonus("sniper", value)} />
          <NumberField label="Crate find chance (0–1)" value={settings.crateFindChance} step={0.05} min={0} max={1} hint="Chance a crate opens when entered." onChange={(value) => update({ crateFindChance: value })} />
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading"><div><span className="step-number">D</span><h2>Sniper</h2></div></div>
        <div className="settings-grid">
          <NumberField label="Sniper hit chance (0–1)" value={settings.sniperHitChance} step={0.05} min={0} max={1} hint="Chance a sniper lands a shot on an adjacent target each round." onChange={(value) => update({ sniperHitChance: value })} />
          <NumberField label="Sniper flat damage" value={settings.sniperFlatDamage} min={0} onChange={(value) => update({ sniperFlatDamage: value })} />
          <NumberField label="Sniper instant-kill chance (0–1)" value={settings.sniperInstantKillChance} step={0.05} min={0} max={1} hint="Chance a hit kills outright instead of flat damage." onChange={(value) => update({ sniperInstantKillChance: value })} />
        </div>
      </section>

      <section className="panel setup-section">
        <div className="section-heading"><div><span className="step-number">E</span><h2>Point defaults</h2></div></div>
        <p className="helper-text">These seed new healing and danger points. Each placed point can be fine-tuned on the setup screen.</p>
        <div className="settings-grid">
          <NumberField label="Default heal amount" value={settings.healAmount} min={0} onChange={(value) => update({ healAmount: value })} />
          <NumberField label="Default heal chance (0–1)" value={settings.healChance} step={0.05} min={0} max={1} onChange={(value) => update({ healChance: value })} />
          <NumberField label="Default heal cooldown (rounds)" value={settings.healCooldownRounds} min={0} onChange={(value) => update({ healCooldownRounds: value })} />
          <NumberField label="Default danger min damage" value={settings.dangerMinDamage} min={0} onChange={(value) => update({ dangerMinDamage: value })} />
          <NumberField label="Default danger max damage" value={settings.dangerMaxDamage} min={0} onChange={(value) => update({ dangerMaxDamage: value })} />
          <NumberField label="Default danger avoid chance (0–1)" value={settings.dangerAvoidChance} step={0.05} min={0} max={1} hint="Chance each occupant avoids all danger damage that round." onChange={(value) => update({ dangerAvoidChance: value })} />
        </div>
      </section>

      <div className="settings-footer">
        <button className="primary-button" onClick={onBack}>Back to setup</button>
      </div>
    </main>
  );
}
