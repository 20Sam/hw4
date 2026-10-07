import { Link } from 'react-router-dom'

export default function About() {
  return (
    <>
      <section className="page-hero photo-hero">
        <p className="eyebrow">About us</p>
        <h1>A New Haven shop for everyone who calls Yale home</h1>
        <p className="hero-lede">
          Campus Customs is the team behind Yale Bulldog Blue. We make it easy to find comfortable, officially licensed
          Yale apparel, whether you're a first-year, a coach, or a grandparent cheering from the stands.
        </p>
      </section>

      <section className="section about-grid">
        <article>
          <h2>Where to find us</h2>
          <p>
            Our shop sits at <strong>57 Broadway in New Haven</strong>, a short walk from Old Campus. Stop in to try on
            a hoodie, or browse online and let our chat assistant help you find the right size.
          </p>
        </article>
        <article>
          <h2>What we carry</h2>
          <p>
            Sweatshirts, hoodies, tees, quarter-zips, and jackets with Yale marks for the residential colleges, varsity
            sports, and the graduate and professional schools. We also stock pieces for the people who cheer Yalies on:
            moms, dads, siblings, and alumni.
          </p>
        </article>
        <article>
          <h2>How we help</h2>
          <p>
            We'd rather tell you a size is sold out than promise something we can't ship. Our assistant reads the same
            catalogue and stock counts our staff use, so the price and availability you see are the real ones.
          </p>
        </article>
        <article>
          <h2>Why licensed matters</h2>
          <p>
            Every item is officially licensed Yale merchandise. That means accurate logos, quality you can count on, and
            support for the university community we're proud to be part of.
          </p>
        </article>
      </section>

      <section className="section section-sand center">
        <h2>Ready to find your next favorite layer?</h2>
        <div className="hero-actions center-actions">
          <Link to="/products" className="btn btn-primary">
            Shop all products
          </Link>
          <Link to="/create-account" className="btn btn-ghost">
            Create an account
          </Link>
        </div>
      </section>
    </>
  )
}
