import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PokemonService } from '../services/PokemonService';

export default function CardDetailsView() {
  const { id } = useLocalSearchParams();
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      console.log('Carregando produto com ID:', id);
      fetchCard();
    } else {
      console.log('Nenhum ID fornecido');
      setLoading(false);
      setError('ID do produto não fornecido');
    }
  }, [id]);

  const fetchCard = async () => {
    try {
      setLoading(true);
      setError(null);
      const produtoEntity = await PokemonService.fetchCardById(id);
      console.log('Produto carregado:', produtoEntity);
      setProduto(produtoEntity);
    } catch (e) {
      console.error('Erro ao carregar produto:', e);
      setError(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text>Carregando detalhes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!produto) {
    return (
      <View style={styles.center}>
        <Text>Produto não encontrado ou ID inválido.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="small" color="#ef5350" />
          </View>
        )}
        <Image
          source={{ uri: produto.images?.small || 'https://via.placeholder.com/300' }}
          style={styles.image}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            console.log('Erro ao carregar imagem');
            setImageLoading(false);
          }}
        />
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{produto.name}</Text>
        <Text style={styles.set}>{produto.set || 'Sem coleção'}</Text>
        <Text style={styles.rarity}>{produto.rarity || 'Sem raridade'}</Text>
        {produto.descricao && <Text style={styles.flavor}>{produto.descricao}</Text>}
        <Text style={styles.pricesTitle}>Preço:</Text>
        <View style={styles.prices}>
          <Text style={styles.priceValue}>R$ {(produto.price || 0).toFixed(2)}</Text>
        </View>
        <Text style={styles.estoque}>Estoque: {produto.estoque || 0} un.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  imageContainer: {
    position: 'relative',
    height: 300,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6fa',
  },
  details: {
    padding: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  set: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  rarity: {
    fontSize: 16,
    color: '#777',
    marginBottom: 4,
  },
  types: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  flavor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  artist: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  pricesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  prices: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef5350',
  },
  estoque: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
});
