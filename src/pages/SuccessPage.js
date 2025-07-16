import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { motion } from 'framer-motion';
import styles from './SuccessPage.module.css';

const SuccessPage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.mainContent}>
        <motion.div 
          className={styles.successCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className={styles.successIcon}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 260,
              damping: 20
            }}
          >
            ✓
          </motion.div>
          <h1 className={styles.successTitle}>Data Saved Successfully!</h1>
          <p className={styles.successMessage}>
            Your carbon footprint data has been successfully saved.
          </p>
          <motion.button 
            onClick={() => navigate('/')}
            className={styles.backButton}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Return to Dashboard
          </motion.button>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default SuccessPage;