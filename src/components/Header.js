import React from 'react';
import styles from './Header.module.css';
import logo from './logo.png';


const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Company Logo" className={styles.logoImage} />
          <div className={styles.logoText}>
            <span className={styles.companyName}>RANE (MADRAS) LIMITED</span>
            <span className={styles.tagline}></span>
          </div>
          
        </div>
        <h1 className={styles.title}>CARBON NEUTRALITY </h1>
        <div className={styles.dateDisplay}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;
