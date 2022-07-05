import { Dialog } from '@ensdomains/thorin'
import { Typography, Button } from '@ensdomains/thorin'

export default function Registration({
	cost,
	commitCost,
	duration,
	name,
	open,
	owner,
	registrationCost,
	setIsOpen,
}) {
	return (
		<>
			<Dialog
				open={open}
				title={`Register ${name}.eth`}
				variant="actionable"
				leading={
					<Button
						shadowless
						variant="secondary"
						onClick={() => setIsOpen(false)}
					>
						Cancel
					</Button>
				}
				trailing={<Button shadowless>Begin</Button>}
				onDismiss={() => setIsOpen(false)}
			>
				<Typography>
					Registering an ENS is a 2 step process. The first
					transaction is ${commitCost.toFixed(2)} and the 2nd is $
					{registrationCost.toFixed(2)}.
				</Typography>
			</Dialog>
		</>
	)
}
