import type { MouseEvent } from "react";
import type { Area, Character } from "../types";

type MapBoardProps = {
  mapImage: string;
  areas: Area[];
  characters: Character[];
  mode?: "play" | "place" | "connect" | "select";
  selectedAreaId?: string;
  connectFromId?: string;
  contestedAreaIds?: string[];
  onPlace?: (x: number, y: number) => void;
  onAreaClick?: (areaId: string) => void;
};

export default function MapBoard({
  mapImage,
  areas,
  characters,
  mode = "play",
  selectedAreaId,
  connectFromId,
  contestedAreaIds = [],
  onPlace,
  onAreaClick,
}: MapBoardProps) {
  const connections = areas.flatMap((area) =>
    area.neighborIds
      .filter((neighborId) => area.id < neighborId)
      .map((neighborId) => ({ from: area, to: areas.find((candidate) => candidate.id === neighborId) }))
      .filter((connection): connection is { from: Area; to: Area } => Boolean(connection.to)),
  );

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== "place" || !onPlace) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onPlace((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };

  return (
    <div
      className={`map-stage map-stage--${mode}`}
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

      {areas.map((area) => {
        const areaCharacters = characters.filter((character) => character.areaId === area.id);
        const isSelected = area.id === selectedAreaId;
        const isConnectStart = area.id === connectFromId;
        const isContested = contestedAreaIds.includes(area.id);
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
                onAreaClick?.(area.id);
              }}
              aria-label={`${area.name}${isContested ? ", conflict" : ""}`}
            >
              <span className="area-name">{area.name}</span>
            </button>
            {areaCharacters.length > 0 && (
              <div className="map-character-stack" aria-label={`Characters at ${area.name}`}>
                {areaCharacters.map((character) => (
                  <div
                    className={`map-character${character.status === "dead" ? " is-defeated" : ""}${character.invulnerable ? " is-invulnerable" : ""}`}
                    title={`${character.name} — ${character.power} power${character.invulnerable ? " — invulnerable" : ""}${character.status === "dead" ? " — dead" : ""}`}
                    key={character.id}
                  >
                    <img src={character.portrait} alt="" />
                    <span className="map-power-badge">{character.power}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
