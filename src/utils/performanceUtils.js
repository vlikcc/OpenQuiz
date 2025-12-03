// Performans optimizasyon yardımcıları

// Debounce fonksiyonu - Sürekli tetiklenen fonksiyonları geciktir
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle fonksiyonu - Belirli aralıklarla çalıştır
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// LocalStorage cache yardımcısı
export const cacheUtils = {
  set: (key, value, ttl = 60000) => {
    const item = {
      value,
      expiry: Date.now() + ttl
    };
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  },
  
  get: (key) => {
    try {
      const itemStr = localStorage.getItem(`cache_${key}`);
      if (!itemStr) return null;
      
      const item = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }
      return item.value;
    } catch (e) {
      return null;
    }
  },
  
  clear: (key) => {
    localStorage.removeItem(`cache_${key}`);
  }
};

// Batch işlem kuyruğu
export class BatchQueue {
  constructor(processFunc, maxBatchSize = 10, maxWait = 1000) {
    this.queue = [];
    this.processFunc = processFunc;
    this.maxBatchSize = maxBatchSize;
    this.maxWait = maxWait;
    this.timeout = null;
  }
  
  add(item) {
    this.queue.push(item);
    
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), this.maxWait);
    }
  }
  
  flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.queue.length > 0) {
      const batch = [...this.queue];
      this.queue = [];
      this.processFunc(batch);
    }
  }
}

// Vote sayısını lokal olarak hesapla (Firestore yükünü azalt)
export const calculateVoteCounts = (votes, questionIndex) => {
  const counts = {};
  let total = 0;
  
  votes.forEach(vote => {
    if (vote.questionIndex === questionIndex && vote.optionIndex !== undefined) {
      counts[vote.optionIndex] = (counts[vote.optionIndex] || 0) + 1;
      total++;
    }
  });
  
  return { counts, total };
};

// Optimistik UI güncelleme helper
export const optimisticUpdate = (currentState, newItem, key = 'id') => {
  const index = currentState.findIndex(item => item[key] === newItem[key]);
  if (index >= 0) {
    return [...currentState.slice(0, index), newItem, ...currentState.slice(index + 1)];
  }
  return [...currentState, newItem];
};

