import { Dialog } from '@ensdomains/thorin'
import { Typography } from '@ensdomains/thorin'

export default function Registration({ open, setIsOpen }) {
	return (
		<>
			<Dialog
				open={open}
				subtitle="Dialog Subtitle"
				title="Dialog Title"
				onDismiss={() => setIsOpen(false)}
			>
				<Typography>Dialog text content.</Typography>
			</Dialog>
		</>
	)
}
