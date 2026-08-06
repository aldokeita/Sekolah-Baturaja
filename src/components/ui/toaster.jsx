import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import React from 'react';

export function Toaster() {
	const { toasts } = useToast();

	return (
		<ToastProvider>
			{/* `dismiss` harus dikeluarkan dari spread: setiap entri toast membawanya
			    (lihat use-toast.js, dipakai timeout auto-dismiss), dan Radix
			    meneruskan prop yang tidak dikenalnya ke elemen <li> — React lalu
			    memperingatkan "Invalid value for prop `dismiss` on <li> tag".
			    Sekaligus disambungkan ke onOpenChange supaya menutup toast lewat
			    tombol X atau geser ikut menghapusnya dari store, bukan menunggu
			    timeout. */}
			{toasts.map(({ id, title, description, action, dismiss, ...props }) => {
				return (
					<Toast
						key={id}
						onOpenChange={(open) => { if (!open) dismiss?.(); }}
						{...props}
					>
						<div className="grid gap-1">
							{title && <ToastTitle>{title}</ToastTitle>}
							{description && (
								<ToastDescription>{description}</ToastDescription>
							)}
						</div>
						{action}
						<ToastClose />
					</Toast>
				);
			})}
			<ToastViewport />
		</ToastProvider>
	);
}