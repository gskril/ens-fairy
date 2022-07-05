import {
	Button,
	Dialog,
	Skeleton,
	Spinner,
	Typography,
} from '@ensdomains/thorin'

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
				className="modal"
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
				<div>
					<Typography
						as="p"
						size="base"
						style={{ marginBottom: '1rem' }}
					>
						Registering an ENS name is a two step process. In
						between the steps, there is a 1 minute waiting period.
						This is to protect you from a bad actor front-running
						your registration.
					</Typography>
					<Typography size="base" weight="medium">
						<ul className="steps">
							<li className="step">
								<Skeleton
									loading={false}
									style={{
										borderRadius: '100%',
										backgroundColor: 'rgba(0,0,0,0.15)',
									}}
								>
									<Spinner color="accent" />
								</Skeleton>
								Commit - ${commitCost.toFixed(2)}
							</li>
							<li className="step">
								<Skeleton
									loading={true}
									style={{
										borderRadius: '100%',
										backgroundColor: 'rgba(0,0,0,0.15)',
									}}
								>
									<Spinner color="accent" />
								</Skeleton>
								Register - ${registrationCost.toFixed(2)}
							</li>
						</ul>
					</Typography>
				</div>
			</Dialog>

			<style jsx>{`
				.steps {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
				}

				.step {
					display: flex;
					gap: 0.5rem;
				}
			`}</style>
		</>
	)
}
