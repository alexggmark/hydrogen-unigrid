// one module, its neighbour, and a two-row block — enough to derive col,
// gutter and row from their positions alone
export function GridProbes() {
  return (
    <>
      <i className="u-probe" data-probe="one" aria-hidden />
      <i className="u-probe" data-probe="across" aria-hidden />
      <i className="u-probe" data-probe="down" aria-hidden />
    </>
  );
}
