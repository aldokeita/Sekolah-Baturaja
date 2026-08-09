const PaymentReceiptWatermark = () => (
    <div
        aria-hidden="true"
        data-testid="payment-receipt-watermark"
        className="pointer-events-none absolute left-0 right-0 top-[50%] z-0 flex -translate-y-1/2 justify-end overflow-hidden px-5 select-none"
    >
        <span className="max-w-full rotate-[-12deg] whitespace-nowrap rounded-lg border-2 border-red-600/30 px-4 py-1.5 text-2xl font-black tracking-[0.14em] text-red-600/30">
            LUNAS
        </span>
    </div>
);

export default PaymentReceiptWatermark;
