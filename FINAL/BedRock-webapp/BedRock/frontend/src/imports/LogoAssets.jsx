import svgPaths from "./svg-98zk994gne";

function LogoLarge() {
  return (
    <div className="absolute contents left-[27px] top-[47px]" data-name="Logo Large">
      <div className="absolute h-[144px] left-[85px] top-[47px] w-[171px]">
        <div className="absolute inset-[-3.55%_-2.92%_-3.59%_-2.92%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 181 154.283">
            <g id="Vector 1">
              <path d={svgPaths.p1ef4100} fill="var(--fill-0, #D9D9D9)" />
              <path d={svgPaths.p324f8880} stroke="var(--stroke-0, black)" strokeWidth="10" />
            </g>
          </svg>
        </div>
      </div>
      <p className="absolute font-['Inter:Black',sans-serif] font-black leading-[normal] left-[27px] not-italic text-[64px] text-black top-[187px]">Bedrock.</p>
    </div>
  );
}

function LogoNoText() {
  return (
    <div className="absolute h-[144px] left-[471px] top-[130px] w-[171px]" data-name="Logo No Text">
      <div className="absolute inset-[-3.55%_-2.92%_-3.59%_-2.92%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 181 154.283">
          <g id="Logo No Text">
            <g id="Vector 1">
              <path d={svgPaths.p1ef4100} fill="var(--fill-0, #D9D9D9)" />
              <path d={svgPaths.p324f8880} stroke="var(--stroke-0, black)" strokeWidth="10" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

function LogoHorizontal() {
  return (
    <div className="absolute contents left-[382px] top-[16px]" data-name="Logo Horizontal">
      <div className="absolute h-[60px] left-[382px] top-[16px] w-[71px]">
        <div className="absolute inset-[-5.97%_-4.93%_-6.03%_-4.93%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 78 67.1995">
            <g id="Vector 2">
              <path d={svgPaths.p83aae80} fill="var(--fill-0, #D9D9D9)" />
              <path d={svgPaths.p23d60900} stroke="var(--stroke-0, black)" strokeWidth="7" />
            </g>
          </svg>
        </div>
      </div>
      <p className="absolute font-['Inter:Black',sans-serif] font-black leading-[normal] left-[467px] not-italic text-[50px] text-black top-[16px]">Bedrock.</p>
    </div>
  );
}

export default function LogoAssets() {
  return (
    <div className="bg-white relative size-full" data-name="Logo Assets">
      <LogoLarge />
      <LogoNoText />
      <LogoHorizontal />
    </div>
  );
}
