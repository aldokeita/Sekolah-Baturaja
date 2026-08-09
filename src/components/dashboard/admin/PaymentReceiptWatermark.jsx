import { cn } from '@/lib/utils';

const PaymentReceiptWatermark = ({ className }) => (
    <div
        aria-hidden="true"
        data-testid="payment-receipt-watermark"
        className={cn('pointer-events-none absolute inset-0 z-0 flex items-center justify-end overflow-hidden px-5 select-none', className)}
    >
        <span className="max-w-full rotate-[-12deg] whitespace-nowrap rounded-lg border-2 border-red-600/30 px-4 py-1.5 text-2xl font-black tracking-[0.14em] text-red-600/30">
            LUNAS
        </span>
    </div>
);

export default PaymentReceiptWatermark;
