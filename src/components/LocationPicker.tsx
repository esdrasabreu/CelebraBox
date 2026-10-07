import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Edit2,
  ExternalLink,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  AlertCircle
} from 'lucide-react';
import { LocationDetails } from '../types';
import {
  LocationProvider,
  LocationSearchResult,
  getDefaultLocationProvider,
  formatAddress,
  generateGoogleMapsSearchUrl
} from '../lib/location';

export interface LocationPickerProps {
  value: LocationDetails;
  onChange: (location: LocationDetails) => void;
  provider?: LocationProvider;
  disabled?: boolean;
  className?: string;
}

export default function LocationPicker({
  value,
  onChange,
  provider: customProvider,
  disabled = false,
  className = '',
}: LocationPickerProps) {
  const provider = useRef<LocationProvider>(customProvider || getDefaultLocationProvider());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  // Manual form mode
  const hasExistingLocation = Boolean(value?.name || value?.address || value?.city);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showAdvancedMaps, setShowAdvancedMaps] = useState(Boolean(value?.mapsLink && !value.mapsLink.includes('google.com/maps/search/?api=1')));

  // Manual form fields
  const [manualForm, setManualForm] = useState({
    name: value?.name || '',
    street: value?.street || '',
    number: value?.number || '',
    complement: value?.complement || '',
    neighborhood: value?.neighborhood || '',
    city: value?.city || '',
    state: value?.state || '',
    postalCode: value?.postalCode || '',
    country: value?.country || 'Brasil',
    mapsUrl: value?.mapsUrl || value?.mapsLink || '',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Keep manual form in sync with external value
  useEffect(() => {
    setManualForm({
      name: value?.name || '',
      street: value?.street || (value?.address ? value.address.split(',')[0]?.trim() : ''),
      number: value?.number || '',
      complement: value?.complement || '',
      neighborhood: value?.neighborhood || '',
      city: value?.city || '',
      state: value?.state || '',
      postalCode: value?.postalCode || '',
      country: value?.country || 'Brasil',
      mapsUrl: value?.mapsUrl || value?.mapsLink || '',
    });
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (disabled || isManualMode) return;

    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    const timer = setTimeout(async () => {
      try {
        const results = await provider.current.search(trimmed);
        setSuggestions(results);
        setIsDropdownOpen(true);
        setHighlightedIndex(-1);
      } catch (err) {
        console.warn('Erro ao buscar localização:', err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [searchQuery, disabled, isManualMode]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle selection from search
  const handleSelectSuggestion = async (suggestion: LocationSearchResult) => {
    setIsSearching(true);
    try {
      const details = await provider.current.getDetails(suggestion);
      const updated: LocationDetails = {
        name: details.name,
        address: details.formattedAddress || details.address || details.name,
        city: details.city || '',
        state: details.state || '',
        mapsLink: details.mapsUrl || details.mapsLink,
        formattedAddress: details.formattedAddress,
        street: details.street,
        number: details.number,
        complement: details.complement,
        neighborhood: details.neighborhood,
        postalCode: details.postalCode,
        country: details.country || 'Brasil',
        latitude: details.latitude,
        longitude: details.longitude,
        provider: details.provider,
        providerPlaceId: details.providerPlaceId,
        mapsUrl: details.mapsUrl,
      };
      onChange(updated);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setIsManualMode(false);
    } catch (err) {
      console.error('Erro ao obter detalhes da localização:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && suggestions.length > 0 && e.key === 'ArrowDown') {
      setIsDropdownOpen(true);
      return;
    }

    if (!isDropdownOpen) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (searchQuery.trim().length >= 3) {
          startManualModeWithQuery(searchQuery.trim());
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else if (searchQuery.trim().length >= 3) {
        // Quick start manual mode with query as name
        startManualModeWithQuery(searchQuery.trim());
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const startManualModeWithQuery = (nameQuery?: string) => {
    setManualForm((prev) => ({
      ...prev,
      name: nameQuery || prev.name || '',
    }));
    setIsManualMode(true);
    setIsDropdownOpen(false);
  };

  const handleSaveManual = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!manualForm.name.trim()) return;

    const formatted = formatAddress(manualForm);
    const autoMapsUrl = generateGoogleMapsSearchUrl({
      name: manualForm.name,
      street: manualForm.street,
      number: manualForm.number,
      neighborhood: manualForm.neighborhood,
      city: manualForm.city,
      state: manualForm.state,
      country: manualForm.country,
      address: formatted,
    });

    const finalMapsUrl = manualForm.mapsUrl?.trim() || autoMapsUrl;

    const updated: LocationDetails = {
      name: manualForm.name.trim(),
      address: formatted || manualForm.name.trim(),
      city: manualForm.city.trim(),
      state: manualForm.state.trim().toUpperCase(),
      mapsLink: finalMapsUrl,
      formattedAddress: formatted,
      street: manualForm.street.trim(),
      number: manualForm.number.trim(),
      complement: manualForm.complement.trim() || undefined,
      neighborhood: manualForm.neighborhood.trim() || undefined,
      postalCode: manualForm.postalCode.trim() || undefined,
      country: manualForm.country.trim() || 'Brasil',
      mapsUrl: finalMapsUrl,
      provider: 'manual',
    };

    onChange(updated);
    setIsManualMode(false);
    setSearchQuery('');
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSaveManual(e);
    }
  };

  // Summary computed address
  const summaryAddress =
    value?.formattedAddress ||
    [value?.address, [value?.city, value?.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ') ||
    'Endereço não especificado';

  const mapsExternalUrl =
    value?.mapsUrl ||
    value?.mapsLink ||
    (value?.name ? generateGoogleMapsSearchUrl(value) : '');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. STATE: Summary Card (When a location is registered and not in manual mode) */}
      {hasExistingLocation && !isManualMode && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:border-slate-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    Local Definido
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mt-1 truncate">
                  {value.name || 'Local do Evento'}
                </h3>
                <p className="text-sm text-slate-600 mt-0.5 leading-relaxed break-words">
                  {summaryAddress}
                </p>
                {(value.city || value.state) && (
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {[value.city, value.state].filter(Boolean).join(' - ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsManualMode(false);
                setSearchQuery('');
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Alterar local</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsManualMode(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar endereço manualmente</span>
            </button>

            {mapsExternalUrl && (
              <a
                href={mapsExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors ml-auto"
              >
                <span>Ver no Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. STATE: Initial Simple Search Input (Progressive Disclosure) */}
      {!isManualMode && (
        <div className="relative space-y-2">
          <label className="block text-sm font-semibold text-slate-800">
            Local do evento
          </label>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>

            <input
              ref={searchInputRef}
              type="text"
              disabled={disabled}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setIsDropdownOpen(true);
              }}
              placeholder="Pesquise o nome do local ou endereço"
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-xs"
              role="combobox"
              aria-expanded={isDropdownOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setIsDropdownOpen(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Secondary Action */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => startManualModeWithQuery(searchQuery)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Preencher endereço manualmente</span>
            </button>

            <span className="text-[11px] text-slate-400">
              Não exige chave ou API para salvar
            </span>
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              id={listboxId}
              role="listbox"
              className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
            >
              {suggestions.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {suggestions.map((item, index) => {
                    const isHighlighted = highlightedIndex === index;
                    return (
                      <li
                        key={item.id}
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => handleSelectSuggestion(item)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`p-3.5 cursor-pointer flex items-start gap-3 transition-colors ${
                          isHighlighted ? 'bg-teal-50/80 text-teal-950' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <Building2 className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : hasSearched && !isSearching ? (
                <div className="p-4 text-center space-y-3">
                  <div className="flex items-center justify-center text-slate-400">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      Nenhum resultado automático para &ldquo;{searchQuery}&rdquo;
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Você pode preencher o nome e os dados diretamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startManualModeWithQuery(searchQuery)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar &ldquo;{searchQuery}&rdquo; manualmente</span>
                  </button>
                </div>
              ) : null}

              {/* Bottom option to always switch to manual */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Prefere digitar tudo?</span>
                <button
                  type="button"
                  onClick={() => startManualModeWithQuery(searchQuery)}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Abrir formulário completo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. STATE: Manual Fields (Progressive Disclosure) */}
      {isManualMode && (
        <div
          className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Cadastro Manual de Localização
              </h3>
            </div>
            {hasExistingLocation && (
              <button
                type="button"
                onClick={() => setIsManualMode(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Nome do Local */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do local <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={disabled}
              value={manualForm.name}
              onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
              onKeyDown={handleManualKeyDown}
              placeholder="Ex.: Fazenda das Flores, Espaço Villa Bella, Paróquia São José"
              className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>

          {/* Rua e Número */}
          <div className="grid sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rua / Logradouro
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.street}
                onChange={(e) => setManualForm({ ...manualForm, street: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Ex.: Estrada do Sol ou Av. das Américas"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.number}
                onChange={(e) => setManualForm({ ...manualForm, number: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Ex.: 120 ou S/N"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          {/* Complemento e Bairro */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Complemento
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.complement}
                onChange={(e) => setManualForm({ ...manualForm, complement: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Ex.: Sala 2, Bloco B, Km 42"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.neighborhood}
                onChange={(e) => setManualForm({ ...manualForm, neighborhood: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Ex.: Jardim das Oliveiras"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          {/* Cidade, Estado e CEP */}
          <div className="grid sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.city}
                onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Ex.: São Paulo"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                maxLength={2}
                disabled={disabled}
                value={manualForm.state}
                onChange={(e) => setManualForm({ ...manualForm, state: e.target.value.toUpperCase() })}
                onKeyDown={handleManualKeyDown}
                placeholder="SP"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all uppercase"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                maxLength={9}
                disabled={disabled}
                value={manualForm.postalCode}
                onChange={(e) => setManualForm({ ...manualForm, postalCode: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="00000-000"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          {/* País com padrão Brasil */}
          <div className="grid sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                País
              </label>
              <input
                type="text"
                disabled={disabled}
                value={manualForm.country}
                onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })}
                onKeyDown={handleManualKeyDown}
                placeholder="Brasil"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div className="pt-5">
              <p className="text-xs text-slate-500">
                O link do Google Maps é <strong>gerado automaticamente</strong> a partir do nome e endereço digitados.
              </p>
            </div>
          </div>

          {/* Advanced Maps link option (Progressive disclosure) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedMaps(!showAdvancedMaps)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span>Opções avançadas (link personalizado do mapa)</span>
              {showAdvancedMaps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedMaps && (
              <div className="mt-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-700">
                  Link customizado do Google Maps (Opcional)
                </label>
                <input
                  type="url"
                  disabled={disabled}
                  value={manualForm.mapsUrl}
                  onChange={(e) => setManualForm({ ...manualForm, mapsUrl: e.target.value })}
                  onKeyDown={handleManualKeyDown}
                  placeholder="https://maps.app.goo.gl/... ou embed"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Deixe vazio para usar a rota gerada automaticamente.
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setIsManualMode(false);
                setSearchQuery('');
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Voltar para busca
            </button>

            <button
              type="button"
              disabled={disabled || !manualForm.name.trim()}
              onClick={handleSaveManual}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar localização</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
