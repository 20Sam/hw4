// "Dan", the Campus Customs bulldog: drawn entirely in HTML/CSS (no image files).
export default function Dan({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`dan ${className}`} style={{ fontSize: `${size}px` }} aria-hidden="true">
      <span className="dan-ear dan-ear-l" />
      <span className="dan-ear dan-ear-r" />
      <span className="dan-head">
        <span className="dan-brow" />
        <span className="dan-eye dan-eye-l" />
        <span className="dan-eye dan-eye-r" />
        <span className="dan-muzzle">
          <span className="dan-nose" />
          <span className="dan-mouth" />
        </span>
      </span>
      <span className="dan-collar">
        <span className="dan-tag">Y</span>
      </span>
    </span>
  )
}
