export function Badge({ tier }: { tier: string }) {
  return (
    <span className={"badge " + tier}>
      <span />
      {tier.replaceAll("_", " ")}
    </span>
  );
}
