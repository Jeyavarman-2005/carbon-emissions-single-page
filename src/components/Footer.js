import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerText}>
          <p>© {new Date().getFullYear()} RANE (MADRAS) LIMITED</p>
          <p>Expanding Horizons</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
