import { cn } from '@/lib/utils';

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const positionClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

const numberInRange = (value, fallback, min, max) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
};

const PaymentReceiptWatermark = ({ className, config }) => {
    const settings = config || {};
    if (settings.visible === false) return null;

    const color = HEX_COLOR.test(settings.color || '') ? settings.color : '#dc2626';
    const opacity = numberInRange(settings.opacity, 0.3, 0.05, 0.6);
    const fontSize = numberInRange(settings.fontSize, 24, 12, 64);
    const rotation = numberInRange(settings.rotation, -12, -30, 30);
    const borderWidth = numberInRange(settings.borderWidth, 2, 1, 8);
    const position = positionClasses[settings.position] ? settings.position : 'center';
    const label = String(settings.text || 'LUNAS').trim() || 'LUNAS';

    return (
        <div
            aria-hidden="true"
            data-testid="payment-receipt-watermark"
            className={cn(`pointer-events-none absolute inset-0 z-0 flex items-center ${positionClasses[position]} overflow-hidden px-5 select-none`, className)}
        >
            <span
                className="max-w-full whitespace-nowrap rounded-lg px-4 py-1.5 font-black tracking-[0.14em]"
                style={{
                    color,
                    borderColor: color,
                    borderStyle: 'solid',
                    borderWidth: `${borderWidth}px`,
                    opacity,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.2,
                    transform: `rotate(${rotation}deg)`,
                }}
            >
                {label}
            </span>
        </div>
    );
};

export default PaymentReceiptWatermark;
