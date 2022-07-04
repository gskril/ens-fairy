import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Home() {
	return (
    <>
      <ConnectButton />
      <form>
        <div>
          <label htmlFor="duration">Registration duration</label>
          <input type="number" name="duration" id="duration" placeholder="1" />
        </div>

        <br /> <br />

        <div>
          <label htmlFor="name">Name to register</label>
          <input type="text" name="name" id="name" placeholder="gregskril.eth" />
        </div>

        <div>
          <label htmlFor="owner">Who are you buying it for?</label>
          <input type="text" name="owner" id="owner" placeholder="0x..." />
        </div>
      </form>
    </>
  )
}
