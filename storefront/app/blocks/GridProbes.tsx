// one module, its neighbour, and a two-row block. everything the measurement
// pass needs is the distance between these three, so no css value is parsed.
export function GridProbes() {
  return (
    <>
      <i className="u-probe" data-probe="one" aria-hidden />
      <i className="u-probe" data-probe="across" aria-hidden />
      <i className="u-probe" data-probe="down" aria-hidden />
    </>
  );
}
