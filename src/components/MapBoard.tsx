import type { CSSProperties, MouseEvent } from "react";
import type { Area, Character, Crate, DangerPoint, HealingPoint, MapWeapon, SniperShot } from "../types";
import { WEAPON_GLYPHS, WEAPON_NAMES } from "../weapons";

type MapBoardProps = {
  mapImage: string;
  areas: Area[];
  characters: Character[];
  mode?: "play" | "place" | "connect" | "select";
  selectedAreaId?: string;
  connectFromId?: string;
  contestedAreaIds?: string[];
  weapons?: MapWeapon[];
  crates?: Crate[];
  healingPoints?: HealingPoint[];
  dangerPoints?: DangerPoint[];
  sniperShots?: SniperShot[];
  onPlace?: (x: number, y: number) => void;
  onAreaClick?: (areaId: string) => void;
  // Play-mode only: fired when a cell is tapped, to open the cell viewer.
  onAreaHold?: (areaId: string) => void;
  // Multiplier for character portrait size on the map (default 1).
  characterScale?: number;
};

// Build the combat + ranged glyph list for a character's held weapons.
const weaponBadges = (character: Character): { slot: string; glyph: string; name: string }[] => {
  const badges: { slot: string; glyph: string; name: string }[] = [];
  if (character.weapon) badges.push({ slot: "combat", glyph: WEAPON_GLYPHS[character.weapon], name: WEAPON_NAMES[character.weapon] });
  if (character.rangedWeapon) badges.push({ slot: "ranged", glyph: WEAPON_GLYPHS[character.rangedWeapon], name: WEAPON_NAMES[character.rangedWeapon] });
  return badges;
};

export default function MapBoard({
  mapImage,
  areas,
  characters,
  mode = "play",
  selectedAreaId,
  connectFromId,
  contestedAreaIds = [],
  weapons = [],
  crates = [],
  healingPoints = [],
  dangerPoints = [],
  sniperShots = [],
  onPlace,
  onAreaClick,
  onAreaHold,
  characterScale = 1,
}: MapBoardProps) {
  const connections = areas.flatMap((area) =>
    area.neighborIds
      .filter((neighborId) => area.id < neighborId)
      .map((neighborId) => ({ from: area, to: areas.find((candidate) => candidate.id === neighborId) }))
      .filter((connection): connection is { from: Area; to: Area } => Boolean(connection.to)),
  );

  const targetedCharacterIds = new Set(sniperShots.map((shot) => shot.targetId));
  const shooterCharacterIds = new Set(sniperShots.map((shot) => shot.shooterId));

  const areaOf = (characterId: string): Area | undefined => {
    const character = characters.find((candidate) => candidate.id === characterId);
    return character ? areas.find((area) => area.id === character.areaId) : undefined;
  };

  // Lines from each sniper shooter's cell to their locked target's cell, so it
  // is clear who is aiming at whom during the hidden phase.
  const aimLines = sniperShots
    .map((shot) => {
      const from = areaOf(shot.shooterId);
      const to = areaOf(shot.targetId);
      return from && to ? { key: `${shot.shooterId}-${shot.targetId}`, from, to } : undefined;
    })
    .filter((line): line is { key: string; from: Area; to: Area } => Boolean(line));

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== "place" || !onPlace) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onPlace((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };

  return (
    <div
      className={`map-stage map-stage--${mode}`}
      style={{ "--char-scale": characterScale } as CSSProperties}
      onClick={handleMapClick}
      role={mode === "place" ? "button" : undefined}
      tabIndex={mode === "place" ? 0 : undefined}
      aria-label={mode === "place" ? "Select a position to place a new circular cell" : "Game map"}
    >
      <img className="map-image" src={mapImage} alt="Campaign map" draggable={false} />
      <svg className="connection-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {connections.map(({ from, to }) => (
          <line
            key={`${from.id}-${to.id}`}
            x1={from.x * 100}
            y1={from.y * 100}
            x2={to.x * 100}
            y2={to.y * 100}
          />
        ))}
      </svg>
      {aimLines.length > 0 && (
        <svg className="aim-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="aim-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#f0574a" />
            </marker>
          </defs>
          {aimLines.map((line) => (
            <line
              key={line.key}
              className="aim-line"
              x1={line.from.x * 100}
              y1={line.from.y * 100}
              x2={line.to.x * 100}
              y2={line.to.y * 100}
              markerEnd="url(#aim-arrow)"
            />
          ))}
        </svg>
      )}

      {areas.map((area) => {
        const areaCharacters = characters.filter((character) => character.areaId === area.id);
        const isSelected = area.id === selectedAreaId;
        const isConnectStart = area.id === connectFromId;
        const isContested = contestedAreaIds.includes(area.id);
        const areaWeapons = weapons.filter((weapon) => weapon.areaId === area.id);
        const areaCrates = crates.filter((crate) => crate.areaId === area.id && !crate.opened);
        const areaHeals = healingPoints.filter((point) => point.areaId === area.id);
        const areaDangers = dangerPoints.filter((point) => point.areaId === area.id);
        const markers: { key: string; className: string; glyph: string; title: string }[] = [
          ...areaWeapons.map((weapon) => ({
            key: `w-${weapon.id}`,
            className: "map-marker map-marker--weapon",
            glyph: WEAPON_GLYPHS[weapon.weapon],
            title: `Dropped ${WEAPON_NAMES[weapon.weapon]}`,
          })),
          ...areaCrates.map((crate) => ({
            key: `c-${crate.id}`,
            className: "map-marker map-marker--crate",
            glyph: "📦",
            title: "Crate",
          })),
          ...areaHeals.map((point) => ({
            key: `h-${point.id}`,
            className: "map-marker map-marker--heal",
            glyph: "✚",
            title: `${point.name}${point.cooldownRemaining > 0 ? ` (cooldown ${point.cooldownRemaining})` : ""}`,
          })),
          ...areaDangers.map((point) => ({
            key: `d-${point.id}`,
            className: "map-marker map-marker--danger",
            glyph: "☠",
            title: point.name,
          })),
        ];
        return (
          <div
            className="area-anchor"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.radius * 200}%`,
            }}
            key={area.id}
          >
            <button
              type="button"
              className={`area-circle${isSelected ? " is-selected" : ""}${isConnectStart ? " is-connect-start" : ""}${isContested ? " is-contested" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                // Play mode: a single tap opens the cell viewer. Editing modes
                // use the normal area click.
                if (mode === "play" && onAreaHold) onAreaHold(area.id);
                else onAreaClick?.(area.id);
              }}
              aria-label={`${area.name}${isContested ? ", conflict" : ""}`}
            >
              <span className="area-name">{area.name}</span>
            </button>
            {markers.length > 0 && (
              <div className="map-marker-stack" aria-hidden="true">
                {markers.map((marker) => (
                  <span className={marker.className} title={marker.title} key={marker.key}>{marker.glyph}</span>
                ))}
              </div>
            )}
            {areaCharacters.length > 0 && (
              <div className="map-character-stack" aria-label={`Characters at ${area.name}`}>
                {areaCharacters.map((character) => {
                  const isTargeted = targetedCharacterIds.has(character.id) && character.status === "active";
                  const isShooter = shooterCharacterIds.has(character.id) && character.status === "active";
                  const badges = weaponBadges(character);
                  // Dead with a custom image renders as a natural-ratio rectangle
                  // (letterboxed); dead without stays the greyed circle; living
                  // stay circular.
                  const hasBodyImage = character.status === "dead" && Boolean(character.deadBodyImage);
                  const weaponTitle = badges.length > 0 ? ` — ${badges.map((badge) => badge.name).join(", ")}` : "";
                  return (
                    <div
                      className={`map-character${character.status === "dead" ? " is-defeated" : ""}${hasBodyImage ? " has-body-image" : ""}${character.invulnerable ? " is-invulnerable" : ""}${isTargeted ? " is-targeted" : ""}${isShooter ? " is-shooter" : ""}`}
                      title={`${character.name} — ${character.power} power${weaponTitle}${character.invulnerable ? " — invulnerable" : ""}${character.status === "dead" ? " — dead" : ""}${isShooter ? " — taking aim" : ""}${isTargeted ? " — in a sniper's sights" : ""}`}
                      key={character.id}
                    >
                      <img src={hasBodyImage ? character.deadBodyImage : character.portrait} alt="" />
                      {badges.length > 0 && (
                        <span className="map-weapon-badge-stack" aria-hidden="true">
                          {badges.map((badge) => (
                            <span className={`map-weapon-badge map-weapon-badge--${badge.slot}`} title={badge.name} key={badge.slot}>{badge.glyph}</span>
                          ))}
                        </span>
                      )}
                      {isShooter && <span className="map-shooter-badge" aria-hidden="true">🎯</span>}
                      {isTargeted && <span className="map-target-badge" aria-hidden="true">◎</span>}
                      {character.status !== "dead" && <span className="map-power-badge">{character.power}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
