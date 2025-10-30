import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentCard from '../../components/AgentCard';

// Mock the hooks
jest.mock('../../hooks/useWebSocket', () => ({
  usePriceUpdates: jest.fn(() => ({
    priceData: null,
    priceHistory: []
  })),
  useTradeEvents: jest.fn(() => ({
    latestTrade: null
  }))
}));

jest.mock('../../hooks/useWallet', () => ({
  useWallet: jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true
  }))
}));

const mockAgent = {
  id: 'test-agent-1',
  name: 'Test Agent',
  symbol: 'TEST',
  description: 'A test agent for unit testing',
  currentPrice: 0.001,
  marketCap: 1000000,
  volume24h: 50000,
  priceChange24h: 0.05,
  holders: 150,
  contractAddress: '0x1234567890123456789012345678901234567890',
  creator: '0x9876543210987654321098765432109876543210',
  createdAt: '2024-01-01T00:00:00.000Z',
  imageUrl: 'https://example.com/test-agent.jpg',
  isVerified: true
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AgentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders agent information correctly', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
    expect(screen.getByText('A test agent for unit testing')).toBeInTheDocument();
    expect(screen.getByText('$0.001000')).toBeInTheDocument();
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });

  test('displays price change with correct color', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const priceChangeElement = screen.getByText('+5.00%');
    expect(priceChangeElement).toBeInTheDocument();
    expect(priceChangeElement).toHaveClass('text-green-400');
  });

  test('displays negative price change with red color', () => {
    const agentWithNegativeChange = {
      ...mockAgent,
      priceChange24h: -0.03
    };

    renderWithProviders(<AgentCard agent={agentWithNegativeChange} />);

    const priceChangeElement = screen.getByText('-3.00%');
    expect(priceChangeElement).toBeInTheDocument();
    expect(priceChangeElement).toHaveClass('text-red-400');
  });

  test('shows verified badge for verified agents', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const verifiedBadge = screen.getByTitle('Verified Agent');
    expect(verifiedBadge).toBeInTheDocument();
  });

  test('does not show verified badge for unverified agents', () => {
    const unverifiedAgent = {
      ...mockAgent,
      isVerified: false
    };

    renderWithProviders(<AgentCard agent={unverifiedAgent} />);

    const verifiedBadge = screen.queryByTitle('Verified Agent');
    expect(verifiedBadge).not.toBeInTheDocument();
  });

  test('navigates to agent detail page when clicked', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const cardElement = screen.getByRole('link');
    expect(cardElement).toHaveAttribute('href', '/agent/test-agent-1');
  });

  test('handles missing image gracefully', () => {
    const agentWithoutImage = {
      ...mockAgent,
      imageUrl: undefined
    };

    renderWithProviders(<AgentCard agent={agentWithoutImage} />);

    const imageElement = screen.getByAltText('Test Agent');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute('src', '/default-agent.png');
  });

  test('formats large numbers correctly', () => {
    const agentWithLargeNumbers = {
      ...mockAgent,
      marketCap: 1500000000, // 1.5B
      volume24h: 75000000 // 75M
    };

    renderWithProviders(<AgentCard agent={agentWithLargeNumbers} />);

    expect(screen.getByText('1.50B')).toBeInTheDocument();
    expect(screen.getByText('75.00M')).toBeInTheDocument();
  });

  test('shows loading state when price data is updating', () => {
    const { usePriceUpdates } = require('../../hooks/useWebSocket');
    usePriceUpdates.mockReturnValue({
      priceData: { price: '0.002', timestamp: Date.now() },
      priceHistory: []
    });

    renderWithProviders(<AgentCard agent={mockAgent} />);

    // Should show updated price
    expect(screen.getByText('$0.002000')).toBeInTheDocument();
  });

  test('handles price animation on updates', async () => {
    const { usePriceUpdates } = require('../../hooks/useWebSocket');
    
    // Initial render
    const { rerender } = renderWithProviders(<AgentCard agent={mockAgent} />);
    
    // Update price
    usePriceUpdates.mockReturnValue({
      priceData: { price: '0.0015', timestamp: Date.now() },
      priceHistory: []
    });

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <AgentCard agent={mockAgent} />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('$0.001500')).toBeInTheDocument();
    });
  });

  test('displays holder count correctly', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Holders')).toBeInTheDocument();
  });

  test('shows creation date', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    // Should show formatted date
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  test('handles hover effects', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const cardElement = screen.getByRole('link');
    
    fireEvent.mouseEnter(cardElement);
    expect(cardElement).toHaveClass('hover:border-blue-400');
    
    fireEvent.mouseLeave(cardElement);
  });

  test('shows quick action buttons for connected wallet', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const buyButton = screen.getByText('Quick Buy');
    const sellButton = screen.getByText('Quick Sell');

    expect(buyButton).toBeInTheDocument();
    expect(sellButton).toBeInTheDocument();
  });

  test('hides quick action buttons for disconnected wallet', () => {
    const { useWallet } = require('../../hooks/useWallet');
    useWallet.mockReturnValue({
      address: null,
      isConnected: false
    });

    renderWithProviders(<AgentCard agent={mockAgent} />);

    const buyButton = screen.queryByText('Quick Buy');
    const sellButton = screen.queryByText('Quick Sell');

    expect(buyButton).not.toBeInTheDocument();
    expect(sellButton).not.toBeInTheDocument();
  });

  test('handles quick buy action', () => {
    const mockOnQuickBuy = jest.fn();
    
    renderWithProviders(
      <AgentCard agent={mockAgent} onQuickBuy={mockOnQuickBuy} />
    );

    const buyButton = screen.getByText('Quick Buy');
    fireEvent.click(buyButton);

    expect(mockOnQuickBuy).toHaveBeenCalledWith(mockAgent);
  });

  test('handles quick sell action', () => {
    const mockOnQuickSell = jest.fn();
    
    renderWithProviders(
      <AgentCard agent={mockAgent} onQuickSell={mockOnQuickSell} />
    );

    const sellButton = screen.getByText('Quick Sell');
    fireEvent.click(sellButton);

    expect(mockOnQuickSell).toHaveBeenCalledWith(mockAgent);
  });

  test('shows favorite button and handles toggle', () => {
    const mockOnToggleFavorite = jest.fn();
    
    renderWithProviders(
      <AgentCard 
        agent={mockAgent} 
        isFavorite={false}
        onToggleFavorite={mockOnToggleFavorite} 
      />
    );

    const favoriteButton = screen.getByRole('button', { name: /favorite/i });
    fireEvent.click(favoriteButton);

    expect(mockOnToggleFavorite).toHaveBeenCalledWith(mockAgent.id);
  });

  test('shows filled favorite icon when favorited', () => {
    renderWithProviders(
      <AgentCard 
        agent={mockAgent} 
        isFavorite={true}
      />
    );

    const favoriteIcon = screen.getByRole('button', { name: /favorite/i });
    expect(favoriteIcon).toHaveClass('text-yellow-400');
  });

  test('handles error states gracefully', () => {
    const agentWithMissingData = {
      ...mockAgent,
      currentPrice: null,
      marketCap: null,
      volume24h: null
    };

    renderWithProviders(<AgentCard agent={agentWithMissingData} />);

    // Should still render without crashing
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('$0.000000')).toBeInTheDocument();
  });

  test('applies correct styling classes', () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    const cardElement = screen.getByRole('link');
    expect(cardElement).toHaveClass('bg-gray-800');
    expect(cardElement).toHaveClass('border');
    expect(cardElement).toHaveClass('rounded-lg');
    expect(cardElement).toHaveClass('transition-all');
  });

  test('shows loading skeleton when agent data is loading', () => {
    renderWithProviders(<AgentCard agent={null} isLoading={true} />);

    const skeletonElements = screen.getAllByTestId('skeleton');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });
});
